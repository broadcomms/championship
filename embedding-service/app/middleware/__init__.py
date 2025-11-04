"""
Middleware Module

Contains request/response processing middleware.
"""

from .metrics import metrics_middleware, get_metrics

__all__ = ['metrics_middleware', 'get_metrics']
