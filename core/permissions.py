from rest_framework import permissions

class IsOwnerOnly(permissions.BasePermission):
    """
    Allow only the object’s author to edit or delete it.
    """
    def has_object_permission(self, request, view, obj):
        return getattr(obj, 'author', None) == request.user
