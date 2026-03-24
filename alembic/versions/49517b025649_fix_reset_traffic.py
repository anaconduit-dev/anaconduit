"""fix_reset_traffic

Revision ID: 49517b025649
Revises: b7f592b4644a
Create Date: 2026-03-24 15:33:54.448245

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '49517b025649'
down_revision: Union[str, Sequence[str], None] = 'b7f592b4644a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Используем batch_alter_table для корректной работы с SQLite
    with op.batch_alter_table('users', schema=None) as batch_op:
        # Мы переопределяем колонку БЕЗ параметра onupdate
        batch_op.alter_column('last_reset_at',
               existing_type=sa.DateTime(),
               server_default=sa.text('CURRENT_TIMESTAMP'), # сохраняем дефолт при создании
               onupdate=None, # ЯВНО убираем onupdate
               nullable=True)

def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        # Возвращаем как было (если нужно откатиться)
        batch_op.alter_column('last_reset_at',
               existing_type=sa.DateTime(),
               server_default=sa.text('CURRENT_TIMESTAMP'),
               onupdate=sa.func.now(),
               nullable=True)
