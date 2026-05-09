#!/usr/bin/env python3
"""
Quick test script for AutoGluon ML Service
Run: python test_ml_service.py
"""

import requests
import json
import time

BASE_URL = "http://localhost:5000"

def test_health():
    """Test health endpoint"""
    print("\n🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/ml/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_config():
    """Test config endpoint"""
    print("\n🔍 Testing config endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/ml/config")
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Presets available: {list(data['presets'].keys())}")
        print(f"AutoGluon available: {data['autogluon_available']}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_train_regression():
    """Test training a regression model"""
    print("\n🔍 Testing regression model training...")
    
    # Sample regression dataset
    data = {
        "dataset_id": "test-regression-001",
        "rows": [
            {"feature1": 1.0, "feature2": 2.0, "target": 3.0},
            {"feature1": 2.0, "feature2": 3.0, "target": 5.0},
            {"feature1": 3.0, "feature2": 4.0, "target": 7.0},
            {"feature1": 4.0, "feature2": 5.0, "target": 9.0},
            {"feature1": 5.0, "feature2": 6.0, "target": 11.0},
        ],
        "target_column": "target",
        "preset": "fast"  # Use fast for quick testing
    }
    
    try:
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/ml/train",
            json=data,
            headers={"Content-Type": "application/json"}
        )
        elapsed = time.time() - start_time
        
        print(f"Status: {response.status_code}")
        print(f"Training time: {elapsed:.2f}s")
        
        result = response.json()
        if result.get('success'):
            print(f"✅ Model trained successfully")
            print(f"   Problem type: {result.get('problem_type')}")
            print(f"   Best model: {result.get('best_model')}")
            print(f"   Performance: {result.get('performance')}")
            print(f"   Preset used: {result.get('preset_used')}")
            return True
        else:
            print(f"❌ Training failed: {result.get('error')}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_train_classification():
    """Test training a classification model"""
    print("\n🔍 Testing classification model training...")
    
    # Sample classification dataset
    data = {
        "dataset_id": "test-classification-001",
        "rows": [
            {"age": 25, "income": 50000, "purchased": "no"},
            {"age": 30, "income": 60000, "purchased": "no"},
            {"age": 45, "income": 80000, "purchased": "yes"},
            {"age": 50, "income": 90000, "purchased": "yes"},
            {"age": 35, "income": 70000, "purchased": "no"},
            {"age": 60, "income": 100000, "purchased": "yes"},
        ],
        "target_column": "purchased",
        "preset": "fast"
    }
    
    try:
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/ml/train",
            json=data,
            headers={"Content-Type": "application/json"}
        )
        elapsed = time.time() - start_time
        
        print(f"Status: {response.status_code}")
        print(f"Training time: {elapsed:.2f}s")
        
        result = response.json()
        if result.get('success'):
            print(f"✅ Model trained successfully")
            print(f"   Problem type: {result.get('problem_type')}")
            print(f"   Best model: {result.get('best_model')}")
            print(f"   Performance: {result.get('performance')}")
            return True
        else:
            print(f"❌ Training failed: {result.get('error')}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_predict():
    """Test making predictions"""
    print("\n🔍 Testing predictions...")
    
    data = {
        "dataset_id": "test-regression-001",
        "input_data": {"feature1": 6.0, "feature2": 7.0}
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ml/predict",
            json=data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status: {response.status_code}")
        result = response.json()
        
        if result.get('success'):
            print(f"✅ Prediction successful")
            print(f"   Input: feature1=6.0, feature2=7.0")
            print(f"   Prediction: {result.get('predictions')}")
            return True
        else:
            print(f"❌ Prediction failed: {result.get('error')}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_list_models():
    """Test listing models"""
    print("\n🔍 Testing list models...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/ml/models")
        print(f"Status: {response.status_code}")
        
        result = response.json()
        if result.get('success'):
            print(f"✅ Found {result.get('count')} models")
            for model in result.get('models', []):
                print(f"   - {model['dataset_id']}: {model['problem_type']}")
            return True
        else:
            print(f"❌ Failed to list models")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_feature_importance():
    """Test feature importance"""
    print("\n🔍 Testing feature importance...")
    
    data = {
        "dataset_id": "test-regression-001"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ml/feature-importance",
            json=data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status: {response.status_code}")
        result = response.json()
        
        if result.get('success'):
            print(f"✅ Feature importance retrieved")
            importance = result.get('importance', {})
            for feature, score in importance.items():
                print(f"   - {feature}: {score:.4f}")
            return True
        else:
            print(f"❌ Failed to get feature importance")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_delete_model():
    """Test deleting a model"""
    print("\n🔍 Testing delete model...")
    
    try:
        response = requests.delete(f"{BASE_URL}/api/ml/models/test-regression-001")
        print(f"Status: {response.status_code}")
        
        result = response.json()
        if result.get('success'):
            print(f"✅ Model deleted successfully")
            return True
        else:
            print(f"❌ Failed to delete model")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("🧪 AutoGluon ML Service Test Suite")
    print("=" * 60)
    
    tests = [
        ("Health Check", test_health),
        ("Config Endpoint", test_config),
        ("Train Regression", test_train_regression),
        ("Train Classification", test_train_classification),
        ("Make Prediction", test_predict),
        ("List Models", test_list_models),
        ("Feature Importance", test_feature_importance),
        ("Delete Model", test_delete_model),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ Test '{name}' crashed: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Summary")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! ML service is working correctly.")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Check the logs above.")

if __name__ == "__main__":
    main()
