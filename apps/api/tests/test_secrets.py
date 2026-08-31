"""Secret resolution: systemd credential files outrank .env, empty falls back."""

from northstar.config import _cred, _env, secret_env


def test_credential_file_wins(tmp_path, monkeypatch):
    (tmp_path / "google_api_key").write_text("cred-value-123\n", encoding="utf-8")
    monkeypatch.setenv("CREDENTIALS_DIRECTORY", str(tmp_path))
    assert _cred("GOOGLE_API_KEY") == "cred-value-123"
    assert _env("GOOGLE_API_KEY") == "cred-value-123"
    assert secret_env("GOOGLE_API_KEY") == "cred-value-123"


def test_empty_credential_falls_back(tmp_path, monkeypatch):
    (tmp_path / "some_unset_secret").write_text("", encoding="utf-8")
    monkeypatch.setenv("CREDENTIALS_DIRECTORY", str(tmp_path))
    monkeypatch.setenv("SOME_UNSET_SECRET", "from-process-env")
    # empty cred file (installer creates them all) must not mask real config
    assert _cred("SOME_UNSET_SECRET") is None
    assert _env("SOME_UNSET_SECRET") == "from-process-env"


def test_missing_credential_dir_is_noop(monkeypatch):
    monkeypatch.delenv("CREDENTIALS_DIRECTORY", raising=False)
    assert _cred("ANYTHING") is None


def test_missing_file_in_dir_is_noop(tmp_path, monkeypatch):
    monkeypatch.setenv("CREDENTIALS_DIRECTORY", str(tmp_path))
    assert _cred("NOT_INSTALLED") is None
