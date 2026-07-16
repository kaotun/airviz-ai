import os
import json
from functools import wraps
import redis.asyncio as redis

# Global redis client
_redis_client = None

async def init():
    global _redis_client
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    _redis_client = redis.from_url(redis_url, decode_responses=True)

async def close():
    global _redis_client
    if _redis_client:
        await _redis_client.close()

def cached(ttl_seconds: int = 300):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not _redis_client:
                return await func(*args, **kwargs)

            # Build a cache key from function name and arguments
            # Simplified: just use func name and str of kwargs/args
            # In a real app, you'd serialize the args robustly.
            key_parts = [func.__name__]
            for arg in args:
                # Tránh lưu nguyên class instance như DB pool vào key
                if not str(type(arg)).find("asyncpg.pool.Pool") > -1:
                    key_parts.append(str(arg))
            for k, v in kwargs.items():
                if k != "pool":
                    key_parts.append(f"{k}:{v}")
                    
            cache_key = "cache:" + ":".join(key_parts)

            try:
                cached_data = await _redis_client.get(cache_key)
                if cached_data:
                    return json.loads(cached_data)
            except Exception as e:
                # Ignore redis errors and fallback to DB
                pass

            # Execute the function
            result = await func(*args, **kwargs)

            # Store result in cache
            try:
                if result is not None:
                    # Note: datetime/date objects need custom serialization if present,
                    # but data_service already converts them to strings.
                    await _redis_client.set(cache_key, json.dumps(result), ex=ttl_seconds)
            except Exception as e:
                pass

            return result
        return wrapper
    return decorator
