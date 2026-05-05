from rest_framework import permissions


class IsSystemAdmin(permissions.BasePermission):
    message = "Доступ разрешен только администратору."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)
