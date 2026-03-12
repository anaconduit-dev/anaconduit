"""initial_migration

Revision ID: 837ecb96e20b
Revises: 
Create Date: 2026-03-12 13:06:55.320680

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '837ecb96e20b'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Важно: для SQLite используем batch_alter_table
    with op.batch_alter_table('admins', schema=None) as batch_op:
        batch_op.add_column(sa.Column('token_version', sa.Integer(), server_default='1', nullable=False))
    
    # Если нужно добавить другие колонки, которые ты создавал в моделях, добавь их сюда так же через batch_op
def downgrade() -> None:
    with op.batch_alter_table('admins', schema=None) as batch_op:
        batch_op.drop_column('token_version')
