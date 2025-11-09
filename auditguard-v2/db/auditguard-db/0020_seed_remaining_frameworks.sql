-- Migration: 0020_seed_remaining_frameworks.sql
-- Description: Add the 7 missing compliance frameworks to reach 13 total frameworks
-- Date: November 8, 2025
-- Reason: Phase 0 specifies 13 frameworks but only 6 were seeded initially

INSERT INTO compliance_frameworks (name, display_name, description, settings) VALUES
    ('soc2', 'SOC 2', 'Service Organization Control 2', '{"color":"#6C5CE7"}'),
    ('ccpa', 'CCPA', 'California Consumer Privacy Act', '{"color":"#FD79A8"}'),
    ('ferpa', 'FERPA', 'Family Educational Rights and Privacy Act', '{"color":"#00B894"}'),
    ('glba', 'GLBA', 'Gramm-Leach-Bliley Act', '{"color":"#FDCB6E"}'),
    ('fisma', 'FISMA', 'Federal Information Security Management Act', '{"color":"#E17055"}'),
    ('pipeda', 'PIPEDA', 'Personal Information Protection and Electronic Documents Act (Canada)', '{"color":"#74B9FF"}'),
    ('coppa', 'COPPA', 'Children Online Privacy Protection Act', '{"color":"#A29BFE"}');
