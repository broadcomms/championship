"""
Test client for the embedding service
Run this to verify the service is working correctly
"""

import requests
import time
import sys

BASE_URL = "http://localhost:8080"


def test_health():
    """Test health endpoint"""
    print("Testing /health endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    print()
    return response.status_code == 200


def test_single_embedding():
    """Test single embedding generation"""
    print("Testing /embed/single endpoint...")
    response = requests.post(
        f"{BASE_URL}/embed/single",
        params={"text": "This is a test document about compliance."}
    )
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Dimensions: {data['dimensions']}")
    print(f"Vector length: {len(data['embedding'])}")
    print(f"First 5 values: {data['embedding'][:5]}")
    print()
    return response.status_code == 200


def test_batch_embeddings():
    """Test batch embedding generation"""
    print("Testing /embed endpoint with batch...")
    
    texts = [
        "Employee remote work policy document",
        "Financial performance report Q3",
        "Data privacy compliance requirements",
        "Access control security policies",
        "Incident response procedures",
    ]
    
    start_time = time.time()
    
    response = requests.post(
        f"{BASE_URL}/embed",
        json={
            "texts": texts,
            "batch_size": 10,
            "normalize": True
        }
    )
    
    latency = (time.time() - start_time) * 1000
    
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Count: {data['count']}")
    print(f"Dimensions: {data['dimensions']}")
    print(f"Server latency: {data['latency_ms']:.2f}ms")
    print(f"Total latency: {latency:.2f}ms")
    print(f"Throughput: {data['count']/latency*1000:.1f} chunks/sec")
    print()
    
    return response.status_code == 200


def test_large_batch():
    """Test large batch processing"""
    print("Testing large batch (100 chunks)...")
    
    texts = [f"This is test document number {i}" for i in range(100)]
    
    start_time = time.time()
    
    response = requests.post(
        f"{BASE_URL}/embed",
        json={
            "texts": texts,
            "batch_size": 32,
            "normalize": True
        }
    )
    
    latency = (time.time() - start_time) * 1000
    
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Count: {data['count']}")
    print(f"Server latency: {data['latency_ms']:.2f}ms")
    print(f"Total latency: {latency:.2f}ms")
    print(f"Throughput: {data['count']/latency*1000:.1f} chunks/sec")
    print()
    
    return response.status_code == 200


def test_metrics():
    """Test metrics endpoint"""
    print("Testing /metrics endpoint...")
    response = requests.get(f"{BASE_URL}/metrics")
    print(f"Status: {response.status_code}")
    print(f"Metrics: {response.json()}")
    print()
    return response.status_code == 200


def run_all_tests():
    """Run all tests"""
    print("=" * 60)
    print("EMBEDDING SERVICE TEST SUITE")
    print("=" * 60)
    print()
    
    tests = [
        ("Health Check", test_health),
        ("Single Embedding", test_single_embedding),
        ("Batch Embeddings", test_batch_embeddings),
        ("Large Batch (100)", test_large_batch),
        ("Metrics", test_metrics),
    ]
    
    results = []
    
    for name, test_func in tests:
        try:
            passed = test_func()
            results.append((name, passed))
        except Exception as e:
            print(f"ERROR in {name}: {str(e)}")
            results.append((name, False))
            print()
    
    print("=" * 60)
    print("TEST RESULTS")
    print("=" * 60)
    
    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{name}: {status}")
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    print()
    print(f"Total: {passed_count}/{total_count} tests passed")
    
    return passed_count == total_count


if __name__ == "__main__":
    try:
        success = run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nTests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nFatal error: {str(e)}")
        sys.exit(1)
