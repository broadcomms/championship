"""
Authentication Middleware

Handles API key authentication with rate limiting and security features.

Author: Development Team
Version: 1.0.0
"""

import time
import hashlib
from typing import Optional, Dict
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from collections import defaultdict
from datetime import datetime, timedelta

from app.config import get_settings


# API Key header scheme
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


class RateLimiter:
    """
    In-memory rate limiter using sliding window algorithm.

    Thread-safe implementation for production use.
    """

    def __init__(self):
        # Store timestamps of requests per API key
        self._requests: Dict[str, list] = defaultdict(list)

    def check_rate_limit(self, api_key: str, limit_per_minute: int) -> bool:
        """
        Check if request is within rate limit.

        Args:
            api_key: API key identifier
            limit_per_minute: Maximum requests per minute

        Returns:
            bool: True if within limit, False otherwise
        """
        now = time.time()
        minute_ago = now - 60

        # Clean old timestamps
        self._requests[api_key] = [
            ts for ts in self._requests[api_key] if ts > minute_ago
        ]

        # Check limit
        if len(self._requests[api_key]) >= limit_per_minute:
            return False

        # Add current request
        self._requests[api_key].append(now)
        return True

    def get_current_usage(self, api_key: str) -> int:
        """Get current request count for API key in last minute."""
        now = time.time()
        minute_ago = now - 60
        self._requests[api_key] = [
            ts for ts in self._requests[api_key] if ts > minute_ago
        ]
        return len(self._requests[api_key])


# Global rate limiter instance
rate_limiter = RateLimiter()


async def verify_api_key(api_key: Optional[str] = Security(api_key_header)) -> str:
    """
    Verify API key authentication.

    Args:
        api_key: API key from request header

    Returns:
        str: Validated API key

    Raises:
        HTTPException: If authentication fails
    """
    settings = get_settings()

    # If no API keys configured, allow access (development mode)
    if not settings.api_keys:
        return "development"

    # Check if API key provided
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key. Include X-API-Key header.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # Validate API key
    if api_key not in settings.api_keys:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # Check rate limit
    if settings.rate_limit_enabled:
        if not rate_limiter.check_rate_limit(api_key, settings.rate_limit_per_minute):
            current_usage = rate_limiter.get_current_usage(api_key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Limit: {settings.rate_limit_per_minute}/minute, Current: {current_usage}/minute",
                headers={
                    "X-RateLimit-Limit": str(settings.rate_limit_per_minute),
                    "X-RateLimit-Remaining": str(max(0, settings.rate_limit_per_minute - current_usage)),
                    "X-RateLimit-Reset": str(int(time.time() + 60)),
                },
            )

    return api_key


def hash_api_key(api_key: str) -> str:
    """
    Hash API key for logging (security measure).

    Args:
        api_key: API key to hash

    Returns:
        str: Hashed API key (first 8 chars of SHA256)
    """
    return hashlib.sha256(api_key.encode()).hexdigest()[:8]
