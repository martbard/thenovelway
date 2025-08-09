# core/serializers.py

from django.db.models import Avg
from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Tag, Story, Chapter, Comment, Rating


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name']


class StorySerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField(read_only=True)
    author_username = serializers.CharField(source='author.username', read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        write_only=True,
        source='tags',
        queryset=Tag.objects.all()
    )
    average_rating = serializers.FloatField(read_only=True)

    class Meta:
        model = Story
        fields = [
            'id',
            'author',
            'author_username',
            'title',
            'summary',
            'status',
            'tags',          # nested list of {id, name}
            'tag_ids',       # write-only list of tag IDs
            'average_rating',
            'created_at',
            'updated_at',
        ]

    def create(self, validated_data):
        tags = validated_data.pop('tags', [])
        story = Story.objects.create(**validated_data)
        story.tags.set(tags)
        return story

    def update(self, instance, validated_data):
        tags = validated_data.pop('tags', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if tags is not None:
            instance.tags.set(tags)
        return instance


class ChapterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chapter
        fields = ['id', 'title', 'content', 'position', 'story']  # story is handled via nested URL
        read_only_fields = ['story']


class CommentSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'user', 'chapter', 'content', 'created_at']


class RatingSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Rating
        fields = ['id', 'user', 'chapter', 'value', 'created_at']


# ---- NEW: lightweight account serializers ----
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'email', 'password']

    def create(self, validated_data):
        user = User(username=validated_data['username'], email=validated_data.get('email', ''))
        user.set_password(validated_data['password'])
        user.save()
        return user
