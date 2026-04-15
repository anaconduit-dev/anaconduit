import sys
from os.path import realpath, dirname
from sqlalchemy import create_engine
from alembic import context
from os.path import splitext, realpath, dirname, join

sys.path.insert(0, dirname(dirname(realpath(__file__))))

from app.core.config import settings
from app.models import Base 
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = settings.database_url.replace("sqlite+aiosqlite://", "sqlite://")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    sync_url = settings.database_url.replace("sqlite+aiosqlite://", "sqlite://")
    connectable = create_engine(sync_url)

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata,
            render_as_batch=True
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()