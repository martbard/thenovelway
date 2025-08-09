# royalroad_clone/urls.py
from django.views.generic import RedirectView
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
    RegisterView,   # NEW
    MeView,         # NEW
)

# Main router for top-level resources
router = DefaultRouter()
router.register(r"tags", TagViewSet, basename="tag")
router.register(r"stories", StoryViewSet, basename="story")
router.register(r"comments", CommentViewSet, basename="comment")
router.register(r"ratings", RatingViewSet, basename="rating")

# Nested router: chapters under stories
stories_router = NestedDefaultRouter(router, r"stories", lookup="story")
stories_router.register(r"chapters", ChapterViewSet, basename="story-chapters")

urlpatterns = [
    # Redirect root URL to API root
    path("", RedirectView.as_view(url="api/", permanent=False)),

    # Admin site
    path("admin/", admin.site.urls),

    # JWT authentication endpoints
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # Registration & profile
    path("api/register/", RegisterView.as_view(), name="register"),  # NEW
    path("api/me/", MeView.as_view(), name="me"),                    # NEW

    # API endpoints
    path("api/", include(router.urls)),
    path("api/", include(stories_router.urls)),

    # Browsable API login/logout
    path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
]
