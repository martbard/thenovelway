# core/views.py
from django.shortcuts import get_object_or_404
from django.db.models import Avg
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Tag, Story, Chapter, Comment, Rating
from .serializers import (
    TagSerializer,
    StorySerializer,
    ChapterSerializer,
    CommentSerializer,
    RatingSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .permissions import IsOwnerOnly, IsStoryOwnerFromURLOrReadOnly


class TagViewSet(viewsets.ModelViewSet):
    """
    Public read; auth required to create/update/delete.
    Returns a plain list (no pagination) for convenience on the frontend.
    """
    queryset = Tag.objects.all().order_by("name")
    serializer_class = TagSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        return [IsAuthenticated()]


class StoryViewSet(viewsets.ModelViewSet):
    """
    Stories with average rating.
    - Read: public
    - Create: authenticated; author set automatically
    - Update/Destroy: ONLY the author
    Filters: ?tags=<id>&status=<value>
    Search: ?search=<text>
    Order:  ?ordering=created_at|updated_at|title  (prefix with - for desc)
    """
    serializer_class = StorySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["tags", "status"]
    search_fields = ["title", "summary", "author__username"]
    ordering_fields = ["created_at", "updated_at", "title"]
    ordering = ["-created_at", "-id"]

    def get_queryset(self):
        # Stable ordering to avoid UnorderedObjectListWarning during pagination
        return (
            Story.objects.select_related("author")
            .prefetch_related("tags")
            .annotate(average_rating=Avg("chapters__ratings__value"))
            .order_by("-created_at", "-id")
        )

    def get_permissions(self):
        if self.action in ["create"]:
            return [IsAuthenticated()]
        if self.action in ["update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsOwnerOnly()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def mine(self, request):
        qs = self.get_queryset().filter(author=request.user)
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)


class ChapterViewSet(viewsets.ModelViewSet):
    """
    Chapters are nested under a story:
      /api/stories/<story_pk>/chapters/
    - Read: public
    - Create/Update/Destroy: ONLY story author
    """
    serializer_class = ChapterSerializer
    permission_classes = [IsStoryOwnerFromURLOrReadOnly]

    def get_queryset(self):
        story_pk = self.kwargs.get("story_pk")
        base = Chapter.objects.select_related("story").order_by("position", "id")
        if story_pk:
            return base.filter(story_id=story_pk)
        return base

    def perform_create(self, serializer):
        story_pk = self.kwargs.get("story_pk")
        story = get_object_or_404(Story, pk=story_pk)
        serializer.save(story=story)


class CommentViewSet(viewsets.ModelViewSet):
    """
    Comments: read public; create requires auth.
    Works with:
      - /api/stories/<story_pk>/chapters/<chapter_pk>/comments/   (nested)
      - /api/comments/ with {"chapter": <id>}                      (flat, if routed)
    """
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def _author_field(self):
        """Detect whether Comment model uses 'author' or 'user' FK."""
        field_names = {f.name for f in Comment._meta.get_fields()}
        if "author" in field_names:
            return "author"
        if "user" in field_names:
            return "user"
        return None

    def get_queryset(self):
        chapter_pk = self.kwargs.get("chapter_pk") or self.request.query_params.get("chapter")
        rel_author = self._author_field()
        qs = Comment.objects.all()
        if rel_author:
            qs = qs.select_related(rel_author)
        if chapter_pk:
            qs = qs.filter(chapter_id=chapter_pk)
        return qs.order_by("-created_at", "-id")

    def create(self, request, *args, **kwargs):
        """
        Inject the chapter id into the serializer data BEFORE validation,
        so we don't get "chapter: This field is required."
        """
        data = request.data.copy()
        chapter_pk = kwargs.get("chapter_pk") or data.get("chapter")
        if not chapter_pk:
            return Response({"chapter": "This field is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate chapter and (if nested) that it belongs to the given story
        chapter = get_object_or_404(Chapter, pk=chapter_pk)
        story_pk = kwargs.get("story_pk")
        if story_pk and str(chapter.story_id) != str(story_pk):
            return Response({"detail": "Chapter does not belong to this story."}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure the serializer sees the chapter FK
        data["chapter"] = chapter.pk

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)

        # Save with correct author field (author/user) and chapter
        save_kwargs = {"chapter": chapter}
        rel_author = self._author_field()
        if rel_author:
            save_kwargs[rel_author] = request.user

        serializer.save(**save_kwargs)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class RatingViewSet(viewsets.ModelViewSet):
    """
    Ratings: anyone can read; authenticated users can create/update their ratings.
    """
    serializer_class = RatingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Rating.objects.select_related("user", "chapter").order_by("-created_at", "-id")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, url_path=r"chapter/(?P<chapter_id>[^/.]+)/average")
    def by_chapter(self, request, chapter_id=None):
        avg = Rating.objects.filter(chapter_id=chapter_id).aggregate(Avg("value"))["value__avg"] or 0
        return Response({"chapter": chapter_id, "average_rating": avg})

    @action(detail=False, url_path=r"story/(?P<story_id>[^/.]+)/average")
    def by_story(self, request, story_id=None):
        avg = Rating.objects.filter(chapter__story_id=story_id).aggregate(Avg("value"))["value__avg"] or 0
        return Response({"story": story_id, "average_rating": avg})


# ---- Registration & profile ----
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
