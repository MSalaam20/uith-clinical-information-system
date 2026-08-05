import base64
import binascii
import mimetypes
import os
import re
import uuid
from pathlib import Path

from django.core.exceptions import ValidationError


DATA_URL_PATTERN = re.compile(
    r'^data:(?P<mime>[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+);base64,(?P<data>.+)$',
    re.DOTALL,
)
ALLOWED_MIME_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
}
MAX_FILE_SIZE = 5 * 1024 * 1024


def _matches_file_signature(mime_type, content):
    if mime_type == 'image/jpeg':
        return content.startswith(b'\xff\xd8\xff')
    if mime_type == 'image/png':
        return content.startswith(b'\x89PNG\r\n\x1a\n')
    if mime_type == 'image/webp':
        return content.startswith(b'RIFF') and content[8:12] == b'WEBP'
    return False


def _safe_path(directory, filename):
    base_path = Path(directory).resolve()
    candidate = (base_path / Path(filename).name).resolve()
    if candidate.parent != base_path:
        raise ValidationError('Unsafe file path.')
    return candidate


def file_to_base64(file_path):
    path = Path(file_path)
    mime_type = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    with path.open('rb') as file_handle:
        encoded = base64.b64encode(file_handle.read()).decode('ascii')
    return f'data:{mime_type};base64,{encoded}'


def base64_to_file(file_data, prefix):
    match = DATA_URL_PATTERN.fullmatch(file_data)
    if not match:
        raise ValidationError('Invalid base64 data URL.')

    mime_type = match.group('mime').lower()
    extension = ALLOWED_MIME_TYPES.get(mime_type)
    if extension is None:
        raise ValidationError('Only JPEG, PNG, and WebP images are accepted.')

    try:
        decoded = base64.b64decode(match.group('data'), validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValidationError('Invalid base64 file content.') from exc

    if not decoded:
        raise ValidationError('Uploaded file is empty.')
    if len(decoded) > MAX_FILE_SIZE:
        raise ValidationError('Uploaded files must be 5 MB or smaller.')
    if not _matches_file_signature(mime_type, decoded):
        raise ValidationError('File content does not match its declared image type.')

    safe_prefix = re.sub(r'[^a-zA-Z0-9_-]', '-', prefix).strip('-') or 'file'
    filename = f'{safe_prefix}-{uuid.uuid4().hex}{extension}'
    return filename, decoded


def _store_data_url(value, prefix, path):
    if path is None:
        raise ValidationError('A storage directory is required for embedded files.')
    filename, decoded = base64_to_file(value, prefix)
    os.makedirs(path, exist_ok=True)
    destination = _safe_path(path, filename)
    with destination.open('xb') as file_handle:
        file_handle.write(decoded)
    return filename


def find_and_replace_files_in_json(data, format, prefix, path=None):
    if isinstance(data, dict):
        for key, value in list(data.items()):
            if isinstance(value, str) and value.startswith(format):
                data[key] = _store_data_url(value, prefix, path)
            elif isinstance(value, (dict, list)):
                find_and_replace_files_in_json(value, format, prefix, path)
    elif isinstance(data, list):
        for index, value in enumerate(data):
            if isinstance(value, str) and value.startswith(format):
                data[index] = _store_data_url(value, prefix, path)
            elif isinstance(value, (dict, list)):
                find_and_replace_files_in_json(value, format, prefix, path)
    return data


def find_and_replace_url_in_json(data, prefix, path):
    if isinstance(data, dict):
        for key, value in list(data.items()):
            if isinstance(value, str) and value.startswith(prefix):
                candidate = _safe_path(path, value)
                if candidate.exists() and candidate.is_file():
                    data[key] = file_to_base64(candidate)
            elif isinstance(value, (dict, list)):
                find_and_replace_url_in_json(value, prefix, path)
    elif isinstance(data, list):
        for index, value in enumerate(data):
            if isinstance(value, str) and value.startswith(prefix):
                candidate = _safe_path(path, value)
                if candidate.exists() and candidate.is_file():
                    data[index] = file_to_base64(candidate)
            elif isinstance(value, (dict, list)):
                find_and_replace_url_in_json(value, prefix, path)
    return data
