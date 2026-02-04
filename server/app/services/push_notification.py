"""Push notification service using Firebase Cloud Messaging."""

import base64
import json
import logging
from typing import Optional

import firebase_admin
from firebase_admin import credentials, messaging

from app.config import get_settings

logger = logging.getLogger(__name__)


class PushNotificationService:
    """Handles sending push notifications via Firebase Cloud Messaging."""

    def __init__(self):
        self.settings = get_settings()
        self._initialized = False

    @property
    def is_configured(self) -> bool:
        """Check if FCM is configured."""
        return self.settings.fcm_configured

    def initialize(self) -> bool:
        """Initialize Firebase Admin SDK."""
        if self._initialized:
            return True

        if not self.is_configured:
            logger.warning("FCM not configured, push notifications disabled")
            return False

        try:
            # Initialize with service account credentials
            json_str = self.settings.firebase_service_account_json
            logger.info(f"Firebase config length: {len(json_str)}, starts with: {json_str[:20]}...")

            # Try to detect if it's base64 encoded
            if not json_str.strip().startswith('{'):
                logger.info("Firebase config appears to be base64 encoded, decoding...")
                try:
                    json_str = base64.b64decode(json_str).decode('utf-8')
                except Exception as e:
                    logger.error(f"Failed to base64 decode: {e}")

            cred_dict = json.loads(json_str)
            logger.info(f"Firebase project_id: {cred_dict.get('project_id')}")
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            self._initialized = True
            logger.info("Firebase Admin SDK initialized successfully")
            return True
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Firebase JSON: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to initialize Firebase: {e}")
            return False

    async def send_silent_ping(
        self,
        fcm_token: str,
        device_id: str,
    ) -> bool:
        """
        Send a silent push notification to wake up the device.

        Args:
            fcm_token: The device's FCM token
            device_id: The device ID for logging

        Returns:
            True if sent successfully
        """
        if not self._initialized and not self.initialize():
            logger.warning("Cannot send push: FCM not initialized")
            return False

        try:
            # Create a silent notification (data-only, no notification payload)
            message = messaging.Message(
                data={
                    "type": "ping",
                    "device_id": device_id,
                    "action": "wake",
                },
                # iOS specific: content-available for silent push
                apns=messaging.APNSConfig(
                    headers={
                        "apns-priority": "5",  # Silent push should use priority 5
                        "apns-push-type": "background",
                    },
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            content_available=True,
                        ),
                    ),
                ),
                # Android specific: high priority for wake-up
                android=messaging.AndroidConfig(
                    priority="high",
                    ttl=60,  # 60 seconds TTL
                ),
                token=fcm_token,
            )

            # Send the message
            response = messaging.send(message)
            logger.info(f"Silent ping sent to device {device_id}: {response}")
            return True

        except messaging.UnregisteredError:
            logger.warning(f"FCM token unregistered for device {device_id}")
            return False
        except Exception as e:
            logger.error(f"Failed to send silent ping to {device_id}: {e}")
            return False

    async def send_command_notification(
        self,
        fcm_token: str,
        device_id: str,
        command: str,
        params: Optional[dict] = None,
    ) -> bool:
        """
        Send a push notification with a command payload.

        Args:
            fcm_token: The device's FCM token
            device_id: The device ID
            command: The command action
            params: Optional command parameters

        Returns:
            True if sent successfully
        """
        if not self._initialized and not self.initialize():
            return False

        try:
            data = {
                "type": "command",
                "device_id": device_id,
                "action": command,
            }
            if params:
                data["params"] = json.dumps(params)

            message = messaging.Message(
                data=data,
                apns=messaging.APNSConfig(
                    headers={
                        "apns-priority": "10",  # High priority for commands
                        "apns-push-type": "background",
                    },
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            content_available=True,
                        ),
                    ),
                ),
                android=messaging.AndroidConfig(
                    priority="high",
                ),
                token=fcm_token,
            )

            response = messaging.send(message)
            logger.info(f"Command notification sent to {device_id}: {response}")
            return True

        except Exception as e:
            logger.error(f"Failed to send command notification: {e}")
            return False


# Singleton instance
push_service = PushNotificationService()
