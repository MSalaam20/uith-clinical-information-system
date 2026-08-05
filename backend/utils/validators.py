import base64
import binascii
import logging
import re
from fastjsonschema import (
    compile as compile_schema,
    JsonSchemaDefinitionException
    )

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    pass


def data_url_format_checker(value):
    if not isinstance(value, str):
        return False
    match = re.fullmatch(
        r'data:image/(jpeg|png|webp);base64,(.+)', value, re.DOTALL
    )
    if not match:
        return False
    try:
        decoded = base64.b64decode(match.group(2), validate=True)
    except (ValueError, binascii.Error):
        return False
    return 0 < len(decoded) <= 5 * 1024 * 1024


FORMATS = {
    'data-url': data_url_format_checker,
    # Добавьте здесь другие форматы, которые вы хотите поддерживать
}


def compile_with_custom_formats(schema):
    try:
        return compile_schema(schema, formats=FORMATS)
    except JsonSchemaDefinitionException as e:
        logger.error(f"Validation error: {e}")
        raise ValidationError({"findings": str(e)})
