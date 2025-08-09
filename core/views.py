# core/views.py
from django.shortcuts import get_object_or_404
from django.db.models import Avg
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Tag, Story, Chapter, Comment, Rating
from .serializers import (
    TagSerializer,
    StorySerializer,
    ChapterSerializer,
    CommentSerializer,
    RatingSerializer,
    RegisterSerializer,   # NEW
    UserSerializer,       # NEW
)
from .permissions import IsOwnerOnly


class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class StoryViewSet(viewsets.ModelViewSet):
    """
    - Annotates each story with average_rating over its chapters' ratings.
    - Supports filtering by tag via ?tags=<tag_id>.
    - Only the author may update/delete.
    """
    queryset = Story.objects.all()
    serializer_class = StorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['tags']  # e.g. /api/stories/?tags=3

    def get_queryset(self):
        return Story.objects.all().annotate(
            average_rating=Avg('chapters__ratings__value')
        )

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOwnerOnly()]
        return super().get_permissions()

    # ---- NEW: /api/stories/mine/ ----
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def mine(self, request):
        qs = self.get_queryset().filter(author=request.user)
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)


class ChapterViewSet(viewsets.ModelViewSet):
    serializer_class = ChapterSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Chapter.objects.filter(story_id=self.kwargs['story_pk'])

    def perform_create(self, serializer):
        story = get_object_or_404(Story, pk=self.kwargs['story_pk'])
        serializer.save(story=story)


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        chap_id = self.request.query_params.get('chapter')
        if chap_id:
            return Comment.objects.filter(chapter_id=chap_id)
        return super().get_queryset()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class RatingViewSet(viewsets.ModelViewSet):
    queryset = Rating.objects.all()
    serializer_class = RatingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, url_path='chapter/(?P<chapter_id>[^/.]+)')
    def by_chapter(self, request, chapter_id=None):
        avg = Rating.objects.filter(chapter_id=chapter_id).aggregate(
            Avg('value')
        )['value__avg'] or 0
        return Response({'chapter': chapter_id, 'average_rating': avg})

    @action(detail=False, url_path='story/(?P<story_id>[^/.]+)/average')
    def by_story(self, request, story_id=None):
        avg = Rating.objects.filter(chapter__story_id=story_id).aggregate(
            Avg('value')
        )['value__avg'] or 0
        return Response({'story': story_id, 'average_rating': avg})


# ---- NEW: registration & profile ----
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
