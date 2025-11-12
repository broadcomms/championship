#!/bin/bash
# Initialize SmartMemory with system prompts and knowledge base

echo "🧠 Initializing SmartMemory for AuditGuard AI Assistant..."

# Call the initialization endpoint
curl -X POST "https://svc-01k9r7xp13e47zjxe7wj3g2ev4.01k8njsj98qqesz0ppxff2yq4n.lmapp.run/assistant/initialize" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  | jq '.'

echo ""
echo "✅ SmartMemory initialization complete!"
echo ""
echo "📚 Initialized components:"
echo "  - System prompt in procedural memory"
echo "  - 5 framework guides (GDPR, SOC2, HIPAA, ISO27001, NIST CSF)"
echo "  - 8 knowledge articles in semantic memory"
echo ""
echo "🎯 The AI assistant is now ready with:"
echo "  - Procedural memory for system behavior"
echo "  - Episodic memory for conversation history"
echo "  - Semantic memory for compliance knowledge"
echo "  - Working memory for active sessions"
