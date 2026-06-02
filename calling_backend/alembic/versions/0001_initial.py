"""initial schema

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on:    Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "leads",
        sa.Column("id",            postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name",          sa.String(200),  nullable=False),
        sa.Column("phone",         sa.String(20),   nullable=False, unique=True),
        sa.Column("address",       sa.Text(),        nullable=True),
        sa.Column("city",          sa.String(100),   nullable=True),
        sa.Column("course_interest", sa.String(200), nullable=True),
        sa.Column("status",        sa.String(50),    nullable=False, server_default="new"),
        sa.Column("do_not_call",   sa.Boolean(),     nullable=False, server_default="false"),
        sa.Column("last_call_id",  sa.String(100),   nullable=True),
        sa.Column("last_call_at",  sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at",    sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at",    sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "conversations",
        sa.Column("id",          postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("lead_id",     postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel",     sa.String(20),  nullable=False),
        sa.Column("call_uuid",   sa.String(100), nullable=True),
        sa.Column("message",     sa.Text(),       nullable=True),
        sa.Column("agent_reply", sa.Text(),       nullable=True),
        sa.Column("direction",   sa.String(20),  nullable=True),
        sa.Column("created_at",  sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_conversations_lead_id", "conversations", ["lead_id"])
    op.create_index("ix_conversations_call_uuid", "conversations", ["call_uuid"])

    op.create_table(
        "callbacks",
        sa.Column("id",                postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("lead_id",           postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("callback_type",     sa.String(50),  nullable=False, server_default="agent"),
        sa.Column("scheduled_at",      sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("status",            sa.String(50),  nullable=False, server_default="pending"),
        sa.Column("notes",             sa.Text(),       nullable=True),
        sa.Column("triggered_call_id", sa.String(100), nullable=True),
        sa.Column("created_at",        sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at",        sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_callbacks_lead_id",    "callbacks", ["lead_id"])
    op.create_index("ix_callbacks_status",     "callbacks", ["status"])
    op.create_index("ix_callbacks_scheduled",  "callbacks", ["scheduled_at"])

    op.create_table(
        "lead_memories",
        sa.Column("id",             postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("lead_id",        postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("summary",        sa.Text(),  nullable=True),
        sa.Column("latest_outcome", sa.String(100), nullable=True),
        sa.Column("next_action",    sa.String(200), nullable=True),
        sa.Column("extracted_data", postgresql.JSONB(), nullable=True),
        sa.Column("created_at",     sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at",     sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("lead_memories")
    op.drop_table("callbacks")
    op.drop_table("conversations")
    op.drop_table("leads")
