"""
Tagging Service for Compliance Frameworks
Tags chunks with relevant compliance frameworks and keywords
"""
import re
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class TaggingService:
    def __init__(self):
        # Compliance framework keywords
        self.framework_keywords = {
            1: {  # SOC 2
                'name': 'SOC 2',
                'keywords': ['soc 2', 'service organization control', 'trust services', 'security', 'availability', 'confidentiality']
            },
            2: {  # ISO 27001
                'name': 'ISO 27001',
                'keywords': ['iso 27001', 'information security', 'isms', 'risk management', 'security controls']
            },
            3: {  # GDPR
                'name': 'GDPR',
                'keywords': ['gdpr', 'data protection', 'privacy', 'personal data', 'consent', 'data subject']
            },
            4: {  # HIPAA
                'name': 'HIPAA',
                'keywords': ['hipaa', 'phi', 'protected health information', 'healthcare', 'medical records']
            },
            5: {  # PCI DSS
                'name': 'PCI DSS',
                'keywords': ['pci dss', 'payment card', 'cardholder data', 'payment security']
            }
        }
        
    def tag_chunk(self, chunk_text: str) -> Dict:
        """
        Tag a chunk with compliance frameworks and keywords
        
        Args:
            chunk_text: Text to analyze
            
        Returns:
            Dictionary with compliance_framework_id, compliance_tags, and keywords
        """
        text_lower = chunk_text.lower()
        
        # Find matching frameworks
        matching_frameworks = []
        all_tags = []
        
        for framework_id, framework_info in self.framework_keywords.items():
            for keyword in framework_info['keywords']:
                if keyword in text_lower:
                    matching_frameworks.append(framework_id)
                    all_tags.append(framework_info['name'])
                    break
                    
        # Extract general keywords
        keywords = self._extract_keywords(chunk_text)
        
        # Get primary framework (first match)
        compliance_framework_id = matching_frameworks[0] if matching_frameworks else None
        
        result = {
            'compliance_framework_id': compliance_framework_id,
            'compliance_tags': list(set(all_tags)),  # Remove duplicates
            'keywords': keywords
        }
        
        logger.debug(f"Tagged chunk with {len(all_tags)} compliance tags and {len(keywords)} keywords")
        return result
        
    def _extract_keywords(self, text: str, max_keywords: int = 10) -> List[str]:
        """
        Extract important keywords from text
        
        Args:
            text: Text to extract keywords from
            max_keywords: Maximum number of keywords to return
            
        Returns:
            List of keywords
        """
        # Simple keyword extraction
        # Remove common words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
                     'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 
                     'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 
                     'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
                     'these', 'those', 'it', 'its', 'they', 'them', 'their'}
        
        # Extract words
        words = re.findall(r'\b[a-z]{3,}\b', text.lower())
        
        # Filter and count
        word_counts = {}
        for word in words:
            if word not in stop_words:
                word_counts[word] = word_counts.get(word, 0) + 1
                
        # Sort by frequency and return top keywords
        sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
        return [word for word, count in sorted_words[:max_keywords]]


# Global instance
tagging_service = TaggingService()
