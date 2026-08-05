from django.db import DatabaseError


SENSITIVE_METADATA_KEYS = {
    'password', 'access', 'refresh', 'token', 'secret', 'authorization'
}


def _is_sensitive_key(key):
    normalized = str(key).lower()
    return any(sensitive in normalized for sensitive in SENSITIVE_METADATA_KEYS)


def _sanitize_value(value):
    if isinstance(value, dict):
        return {
            str(key): _sanitize_value(item)
            for key, item in value.items()
            if not _is_sensitive_key(key)
        }
    if isinstance(value, (list, tuple)):
        return [_sanitize_value(item) for item in value]
    return value


def _safe_metadata(metadata):
    if not isinstance(metadata, dict):
        return {}
    return _sanitize_value(metadata)


def log_action(
    *,
    action,
    resource_type,
    description='',
    resource_id=None,
    request=None,
    user=None,
    success=True,
    metadata=None,
):
    from records.models import AuditLog

    if request is not None:
        user = request.user if request.user.is_authenticated else user
        forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
        ip_address = (
            forwarded_for.split(',')[0].strip()
            if forwarded_for
            else request.META.get('REMOTE_ADDR')
        )
        method = request.method
        path = request.path[:500]
    else:
        ip_address = None
        method = ''
        path = ''

    try:
        return AuditLog.objects.create(
            user=user if getattr(user, 'is_authenticated', False) else None,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id or ''),
            description=description[:500],
            ip_address=ip_address,
            request_method=method,
            request_path=path,
            success=success,
            metadata=_safe_metadata(metadata),
        )
    except DatabaseError:
        return None
