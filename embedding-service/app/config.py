"""
Configuration Module for Production Embedding Service

Manages all application configuration with environment variable support,
validation, and secure defaults.

Author: Development Team
Version: 1.0.0
"""

import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field, validator


class Settings(BaseSettings):
    """
    Application settings with validation and environment variable support.

    All settings can be overridden via environment variables.
    """

    # API Configuration
    api_title: str = "Production Embedding Service"
    api_version: str = "1.0.0"
    api_description: str = "High-performance embedding generation service with authentication"

    # Server Configuration
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8080, ge=1024, le=65535, description="Server port")
    workers: int = Field(default=4, ge=1, le=16, description="Number of worker processes")
    worker_timeout: int = Field(default=120, ge=30, description="Worker timeout in seconds")

    # Authentication - use string for env parsing, convert to list in validator
    api_keys_str: str = Field(default="", alias="API_KEYS", description="Comma-separated list of valid API keys")
    
    @property
    def api_keys(self) -> List[str]:
        """Convert api_keys_str to list of keys."""
        if not self.api_keys_str:
            return []
        return [k.strip() for k in self.api_keys_str.split(",") if k.strip()]

    # Model Configuration
    model_name: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2",
        description="HuggingFace model identifier"
    )
    model_dimensions: int = Field(default=384, ge=1, description="Embedding dimensions")
    model_cache_dir: Optional[str] = Field(default=None, description="Model cache directory")
    device: str = Field(default="cpu", description="Device for model inference (cpu/cuda)")

    # Request Limits
    max_batch_size: int = Field(default=32, ge=1, le=128, description="Maximum batch size")
    max_text_length: int = Field(default=8192, ge=1, description="Maximum text length per item")
    max_request_size: int = Field(default=10 * 1024 * 1024, description="Max request size in bytes (10MB)")

    # Rate Limiting
    rate_limit_enabled: bool = Field(default=True, description="Enable rate limiting")
    rate_limit_per_minute: int = Field(default=100, ge=1, description="Requests per minute per API key")

    # Caching
    cache_enabled: bool = Field(default=True, description="Enable response caching")
    cache_size: int = Field(default=1000, ge=0, description="LRU cache size")
    cache_ttl: int = Field(default=3600, ge=0, description="Cache TTL in seconds")

    # Monitoring
    enable_metrics: bool = Field(default=True, description="Enable Prometheus metrics")
    enable_detailed_logging: bool = Field(default=True, description="Enable detailed request logging")
    log_level: str = Field(default="INFO", description="Logging level")

    # CORS
    cors_enabled: bool = Field(default=True, description="Enable CORS")
    cors_origins: List[str] = Field(
        default_factory=lambda: ["*"],
        description="Allowed CORS origins"
    )

    # Health Check
    health_check_enabled: bool = Field(default=True, description="Enable health check endpoints")

    # Database Configuration (PostgreSQL)
    db_host: str = Field(default="localhost", description="PostgreSQL host")
    db_port: int = Field(default=5432, ge=1024, le=65535, description="PostgreSQL port")
    db_name: str = Field(default="auditguard", description="PostgreSQL database name")
    db_user: str = Field(default="postgres", description="PostgreSQL user")
    db_password: str = Field(default="", description="PostgreSQL password")
    db_pool_size: int = Field(default=10, ge=1, le=50, description="Connection pool size")
    db_max_overflow: int = Field(default=20, ge=0, description="Max pool overflow connections")

    @validator("api_keys_str")
    def validate_api_keys(cls, v):
        """Validate API keys format."""
        if not v:
            return v  # Allow empty
        
        keys = [k.strip() for k in v.split(",") if k.strip()]
        
        # Validate key format
        for key in keys:
            if len(key) < 16:
                raise ValueError(f"API key too short (minimum 16 characters): {key[:8]}...")
        return v

    @validator("log_level")
    def validate_log_level(cls, v):
        """Validate log level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        v = v.upper()
        if v not in valid_levels:
            raise ValueError(f"Invalid log level. Must be one of: {', '.join(valid_levels)}")
        return v

    @validator("device")
    def validate_device(cls, v):
        """Validate device selection."""
        if v not in ["cpu", "cuda", "mps"]:
            raise ValueError("Device must be 'cpu', 'cuda', or 'mps'")
        # Check if CUDA is available when requested
        if v == "cuda":
            try:
                import torch
                if not torch.cuda.is_available():
                    import warnings
                    warnings.warn("CUDA requested but not available, falling back to CPU")
                    return "cpu"
            except ImportError:
                import warnings
                warnings.warn("torch not installed, using CPU")
                return "cpu"
        return v

    model_config = {
        'env_file': '.env',
        'env_file_encoding': 'utf-8',
        'case_sensitive': False,
        'extra': 'ignore'
    }


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """
    Get application settings.

    Returns:
        Settings: Application configuration
    """
    return settings


def validate_settings() -> None:
    """
    Validate all settings on startup.

    Raises:
        ValueError: If any setting is invalid
    """
    _settings = get_settings()

    # Validate model configuration
    if _settings.model_dimensions <= 0:
        raise ValueError("model_dimensions must be positive")

    # Validate worker configuration
    if _settings.workers <= 0:
        raise ValueError("workers must be positive")

    # Warn if no API keys in production
    if not _settings.api_keys:
        print("⚠️  WARNING: No API keys configured. Service will run without authentication!")
    else:
        print(f"✅ Authentication enabled with {len(_settings.api_keys)} API key(s)")

    print(f"✅ Settings validated successfully")
    print(f"   - Model: {_settings.model_name}")
    print(f"   - Dimensions: {_settings.model_dimensions}")
    print(f"   - Device: {_settings.device}")
    print(f"   - Workers: {_settings.workers}")
    print(f"   - Rate Limit: {_settings.rate_limit_per_minute}/minute")
    print(f"   - Max Batch: {_settings.max_batch_size}")
