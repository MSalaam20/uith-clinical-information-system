from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


ICD11_TERMS = [
    {
        'code': '1A00',
        'title': 'Cholera',
        'chapter': 'Certain infectious or parasitic diseases',
    },
    {
        'code': '1A40',
        'title': 'Malaria',
        'chapter': 'Certain infectious or parasitic diseases',
    },
    {
        'code': '5A11',
        'title': 'Type 2 diabetes mellitus',
        'chapter': 'Endocrine, nutritional or metabolic diseases',
    },
    {
        'code': 'BA00',
        'title': 'Essential hypertension',
        'chapter': 'Diseases of the circulatory system',
    },
    {
        'code': 'CA23',
        'title': 'Acute upper respiratory infection',
        'chapter': 'Diseases of the respiratory system',
    },
    {
        'code': 'MG30',
        'title': 'Acute pain',
        'chapter': 'Symptoms, signs or clinical findings',
    },
    {
        'code': '9C83',
        'title': 'Headache',
        'chapter': 'Diseases of the nervous system',
    },
]


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def icd11_search(request):
    query = request.query_params.get('q', '').strip().lower()

    if not query:
        return Response({'results': []})

    results = [
        term for term in ICD11_TERMS
        if query in term['code'].lower()
        or query in term['title'].lower()
        or query in term['chapter'].lower()
    ]

    return Response({'results': results})
