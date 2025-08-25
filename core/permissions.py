# core/permissions.py
from rest_framework.permissions import BasePermission, SAFE_METHODS
from .models import Story

class IsOwnerOnly(BasePermission):
    """
    Object-level: allow SAFE_METHODS to anyone; writes only if obj.author == request.user.
    Use on Story objects.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return getattr(obj, "author_id", None) == getattr(request.user, "id", None)


class IsStoryOwnerFromURLOrReadOnly(BasePermission):
    """
    For nested Chapter routes (/stories/<story_pk>/chapters/...):
      - SAFE_METHODS: allow
      - POST/PUT/PATCH/DELETE: only if the story in URL belongs to request.user.
    Also protects object-level operations (chapter.story.author == user).
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        story_pk = view.kwargs.get("story_pk") or request.data.get("story")
        if not story_pk or not request.user or not request.user.is_authenticated:
            return False
        try:
            story = Story.objects.only("id", "author_id").get(pk=story_pk)
        except Story.DoesNotExist:
            return False
        return story.author_id == request.user.id

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        story = getattr(obj, "story", None)
        author_id = getattr(getattr(story, "author", None), "id", None)
        return author_id == getattr(request.user, "id", None)
