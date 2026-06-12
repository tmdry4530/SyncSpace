-- Extends a2a_event_type enum with 7 engineering event kinds for Mission View v2.
-- These are additive only; existing values and behaviour are unchanged.
alter type a2a_event_type add value if not exists 'agent_status';
alter type a2a_event_type add value if not exists 'pipeline_stage';
alter type a2a_event_type add value if not exists 'file_edit';
alter type a2a_event_type add value if not exists 'command_run';
alter type a2a_event_type add value if not exists 'test_result';
alter type a2a_event_type add value if not exists 'review_comment';
alter type a2a_event_type add value if not exists 'vcs_event';
