"""
Text Chunking Service
Splits documents into smaller chunks for embedding
"""
import os
import re
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


class ChunkingService:
    def __init__(self):
        self.chunk_size = int(os.getenv('CHUNK_SIZE', '512'))
        self.chunk_overlap = int(os.getenv('CHUNK_OVERLAP', '50'))
        self.max_chunk_size = int(os.getenv('MAX_CHUNK_SIZE', '1024'))
        
    def chunk_text(self, text: str, document_id: str) -> List[Dict]:
        """
        Chunk text into smaller pieces with overlap
        
        Args:
            text: Raw text to chunk
            document_id: Document identifier
            
        Returns:
            List of chunk dictionaries with metadata
        """
        # Clean and normalize text
        text = self._clean_text(text)
        
        # Split into sentences for better chunking
        sentences = self._split_sentences(text)
        
        chunks = []
        current_chunk = []
        current_length = 0
        chunk_index = 0
        char_position = 0
        
        for sentence in sentences:
            sentence_length = len(sentence)
            
            # If adding this sentence exceeds chunk size, save current chunk
            if current_length + sentence_length > self.chunk_size and current_chunk:
                chunk_text = ' '.join(current_chunk)
                chunk_char_count = len(chunk_text)
                
                chunks.append({
                    'chunk_index': chunk_index,
                    'chunk_text': chunk_text,
                    'token_count': self._estimate_tokens(chunk_text),
                    'char_count': chunk_char_count,
                    'start_position': char_position,
                    'end_position': char_position + chunk_char_count,
                    'has_header': self._has_header(chunk_text),
                    'section_title': self._extract_section_title(chunk_text)
                })
                
                # Keep overlap
                overlap_sentences = current_chunk[-2:] if len(current_chunk) > 2 else current_chunk
                current_chunk = overlap_sentences + [sentence]
                current_length = sum(len(s) for s in current_chunk)
                char_position += chunk_char_count
                chunk_index += 1
            else:
                current_chunk.append(sentence)
                current_length += sentence_length
                
        # Add remaining chunk
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            chunks.append({
                'chunk_index': chunk_index,
                'chunk_text': chunk_text,
                'token_count': self._estimate_tokens(chunk_text),
                'char_count': len(chunk_text),
                'start_position': char_position,
                'end_position': char_position + len(chunk_text),
                'has_header': self._has_header(chunk_text),
                'section_title': self._extract_section_title(chunk_text)
            })
            
        logger.info(f"Created {len(chunks)} chunks for document {document_id}")
        return chunks
        
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove special characters but keep punctuation
        text = re.sub(r'[^\w\s.,!?;:()\-"\'\[\]]', '', text)
        return text.strip()
        
    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        # Simple sentence splitting
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]
        
    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count (rough approximation)"""
        return len(text.split())
        
    def _has_header(self, text: str) -> bool:
        """Check if chunk starts with a header"""
        # Simple heuristic: check if first line is short and ends without punctuation
        lines = text.split('\n')
        if lines and len(lines[0]) < 100:
            first_line = lines[0].strip()
            return not first_line.endswith(('.', '!', '?'))
        return False
        
    def _extract_section_title(self, text: str) -> str:
        """Extract section title if present"""
        if self._has_header(text):
            lines = text.split('\n')
            return lines[0].strip() if lines else None
        return None


# Global instance
chunking_service = ChunkingService()
