# royalroad_clone/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested.routers import NestedDefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.views import (
    TagViewSet,
    StoryViewSet,
    ChapterViewSet,
    CommentViewSet,
    RatingViewSet,
    RegisterView,
    MeView,
)

router = DefaultRouter()
router.register("tags", TagViewSet, basename="tag")
router.register("stories", StoryViewSet, basename="story")
router.register("ratings", RatingViewSet, basename="rating")
router.register("comments", CommentViewSet, basename="comment")  # NEW: flat /api/comments/

# /api/stories/<story_id>/chapters/
chapters_router = NestedDefaultRouter(router, "stories", lookup="story")
chapters_router.register("chapters", ChapterViewSet, basename="story-chapters")

# /api/stories/<story_id>/chapters/<chapter_id>/comments/
comments_router = NestedDefaultRouter(chapters_router, "chapters", lookup="chapter")
comments_router.register("comments", CommentViewSet, basename="chapter-comments")

urlpatterns = [
    path("admin/", admin.site.urls),

    # Core API
    path("api/", include(router.urls)),
    path("api/", include(chapters_router.urls)),
    path("api/", include(comments_router.urls)),

    # Auth & profile
    path("api/register/", RegisterView.as_view(), name="register"),
    path("api/me/", MeView.as_view(), name="me"),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]
