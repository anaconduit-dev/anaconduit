import httpx

GITHUB_API_URL = "https://api.github.com/repos/XTLS/Xray-core/releases"

async def get_xray_releases():
    async with httpx.AsyncClient() as client:
        try:
            # GitHub API требует User-Agent
            response = await client.get(
                GITHUB_API_URL, 
                headers={"User-Agent": "PyRay-Panel"}
            )
            response.raise_for_status()
            releases = response.json()
            
            # Формируем чистый список: только название тега и ссылка на скачивание
            return [
                {
                    "version": release["tag_name"],
                    "prerelease": release["prerelease"],
                    "published_at": release["published_at"],
                    "url": release["html_url"]
                }
                for release in releases
            ]
        except httpx.HTTPStatusError as e:
            return {"error": f"GitHub API error: {e.response.status_code}"}
        except Exception as e:
            return {"error": str(e)}
