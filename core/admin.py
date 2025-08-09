from django.contrib import admin
from .models import Tag, Story, Chapter, Comment, Rating

admin.site.register(Tag)
admin.site.register(Story)
admin.site.register(Chapter)
admin.site.register(Comment)
admin.site.register(Rating)