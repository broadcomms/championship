"""
API Routes Module

Contains all API endpoint definitions.
"""

from .health import router as health_router
from .embeddings import router as embeddings_router

__all__ = ['health_router', 'embeddings_router']
