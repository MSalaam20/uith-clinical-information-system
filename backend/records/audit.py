from django.db import DatabaseError


SENSITIVE_METADATA_KEYS = {
    'password', 'access', 'refresh', 'token', 'secret', 'authorization'
}


def _safe_metadata(metadata):
    if not isinstance(metadata, dict):
        return {}
    return {
        str(key): value
        for key, value in metadata.items()
        if str(key).lower() not in SENSITIVE_METADATA_KEYS
    }


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
