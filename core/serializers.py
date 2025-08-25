# core/serializers.py
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.db.models import Avg
from rest_framework import serializers
from .models import Tag, Story, Chapter, Comment, Rating


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email"]


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name"]


class StorySerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField(read_only=True)  # username
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, required=False, queryset=Tag.objects.all()
    )
    average_rating = serializers.FloatField(read_only=True)

    class Meta:
        model = Story
        fields = [
            "id",
            "title",
            "summary",
            "status",
            "author",
            "tags",
            "tag_ids",
            "average_rating",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["author", "average_rating", "created_at", "updated_at"]

    def create(self, validated_data):
        tag_ids = validated_data.pop("tag_ids", [])
        story = Story.objects.create(**validated_data)
        if tag_ids:
            story.tags.set(tag_ids)
        return story

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop("tag_ids", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if tag_ids is not None:
            instance.tags.set(tag_ids)
        return instance


class ChapterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chapter
        fields = ["id", "title", "content", "position", "story", "created_at", "updated_at"]
        read_only_fields = ["story", "created_at", "updated_at"]


class CommentSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)  # username

    class Meta:
        model = Comment
        fields = ["id", "user", "chapter", "content", "created_at"]
        read_only_fields = ["user", "created_at"]


class RatingSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Rating
        fields = ["id", "user", "chapter", "value", "created_at"]
        read_only_fields = ["user", "created_at"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["username", "email", "password"]

    def validate_password(self, value):
        # Run Django’s configured validators for clearer errors
        validate_password(value)
        return value

    def create(self, validated_data):
        user = User(username=validated_data["username"], email=validated_data.get("email", ""))
        user.set_password(validated_data["password"])
        user.save()
        return user
