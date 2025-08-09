# core/models.py

from django.db import models
from django.contrib.auth.models import User

class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


class Story(models.Model):
    STATUS_CHOICES = [
        ('ONGOING',   'Ongoing'),
        ('COMPLETED', 'Completed'),
    ]

    author     = models.ForeignKey(User, on_delete=models.CASCADE, related_name='stories')
    title      = models.CharField(max_length=255)
    summary    = models.TextField()
    status     = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ONGOING')
    tags       = models.ManyToManyField(Tag, through='StoryTag', related_name='stories')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class StoryTag(models.Model):
    story = models.ForeignKey(Story, on_delete=models.CASCADE)
    tag   = models.ForeignKey(Tag,   on_delete=models.CASCADE)

    class Meta:
        unique_together = ('story', 'tag')


class Chapter(models.Model):
    story      = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='chapters')
    title      = models.CharField(max_length=255)
    content    = models.TextField()
    position   = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['position']

    def __str__(self):
        return f"{self.story.title} - {self.title}"


class Comment(models.Model):
    user       = models.ForeignKey(User, on_delete=models.CASCADE)
    chapter    = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name='comments')
    content    = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment by {self.user.username} on {self.chapter.title}"


class Rating(models.Model):
    user       = models.ForeignKey(User, on_delete=models.CASCADE)
    chapter    = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name='ratings')
    value      = models.PositiveSmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user','chapter')

    def __str__(self):
        return f"Rating {self.value} by {self.user.username} on {self.chapter.title}"
