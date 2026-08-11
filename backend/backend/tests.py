from django.test import SimpleTestCase, override_settings


class HealthCheckTests(SimpleTestCase):
    @override_settings(SECURE_SSL_REDIRECT=True)
    def test_health_check_is_public_and_non_sensitive(self):
        response = self.client.get('/health/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})
