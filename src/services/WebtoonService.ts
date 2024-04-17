import { DBManager } from 'configs/db';
import { getMetadata, getOriginLink } from 'MetadataUtil';
import { Select, WebtoonRepository } from 'WebtoonRepository';
import { PlatformRepository } from 'PlatformRepository';
import { LinkRepository } from 'LinkRepository';
import { WebtoonPlatformRepository } from 'WebtoonPlatformRepository';
import { PlatformDTO, WebtoonDTO, WebtoonDetailsDTO, WebtoonsOutDTO } from 'WebtoonDTO';

const dbManager = DBManager.getInstance();
const webtoonRepository = WebtoonRepository.getInstance();
const platformRepository = PlatformRepository.getInstance();
const linkRepository = LinkRepository.getInstance();
const webtoonPlatformRepository = WebtoonPlatformRepository.getInstance();

/**
 * 웹툰 조회 (전체 / 북마크)
 */
async function getWebtoons(select: Select, user: string, page: number, size: number) {
    try {
        let result;
        if (select == Select.ALL) result = await webtoonRepository.paginateWebtoonsIncludeBookmarkWithSequelize(Select.ALL, user, page, size);
        else if (select == Select.BOOKMARK) result = await webtoonRepository.paginateWebtoonsIncludeBookmarkWithSequelize(Select.BOOKMARK, user, page, size);

        const { data, totalPages } = result;
        const webtoons = data.map((webtoon: any) => {
            return new WebtoonDTO(
                webtoon.get().id,
                webtoon.get().image,
                webtoon.get().title,
                webtoon.get().author,
                webtoon.get().desc,
                webtoon.get().bookmark
            );
        });
        return new WebtoonsOutDTO(totalPages, webtoons);
    } catch (error) {
        console.error('웹툰 조회 실패:', error);
        throw error;
    }
}

/**
 * 웹툰 상세 조회
 */
async function getWebtoonDetails(id: number, user: string) {
    try {
        const data = await webtoonRepository.findWebtoonIncludePlatformByIdWithSequelize(id, user);

        const { webtoon_platforms } = data;

        const webtoon = new WebtoonDTO(
            data.get().id,
            data.get().image,
            data.get().title,
            data.get().author,
            data.get().desc,
            data.get().bookmark
        );
        const platforms = webtoon_platforms.map((wp: any) => {
            const { platform } = wp;
            return new PlatformDTO(
                platform.image,
                platform.name,
                platform.url
            );
        });

        return new WebtoonDetailsDTO(webtoon, platforms);
    } catch (error) {
        console.error('웹툰 상세 조회 실패:', error);
        throw error;
    }
}

/**
 * 웹툰 등록
 */
async function registerWebtoon(url: URL) {
    const sequelize = dbManager.getSequelize();
    const transaction = await sequelize.transaction();

    try {
        if (url.origin.includes('naver.me')) url = await getOriginLink(url.toString());
        const path = url.pathname + url.search;

        // 이미 등록된 url인지 확인
        const existingUrl = await linkRepository.findLinkByUrlWithSequelize(path);

        if (existingUrl) return existingUrl.get().webtoonId;

        // 아니면 메타데이터 가져오기
        const data = await getMetadata(url);

        // 이미 등록된 웹툰인지 확인
        const title = data.getWebtoon().getTitle();
        let webtoon = await webtoonRepository.findWebtoonByTitleWithSequelize(title);

        // 웹툰 등록
        if (!webtoon) webtoon = await webtoonRepository.saveWithSequelize(data, transaction);

        // 이미 등록된 플랫폼인지 확인
        const name = data.getPlatform().getName();
        let platform = await platformRepository.findPlatformByNameWithSequelize(name);

        // 플랫폼 등록
        if (!platform) platform = await platformRepository.saveWithSequelize(data, transaction);

        const webtoonId = webtoon.get().id;
        const platformId = platform.get().id;

        // 관계 설정
        await webtoonPlatformRepository.saveWithSequelize(webtoonId, platformId, transaction);
        await linkRepository.saveWithSequelize(path, webtoonId, platformId, transaction);

        await transaction.commit();

        return webtoonId;
    } catch (error) {
        await transaction.rollback();
        console.error('웹툰 등록 실패:', error);
        throw error;
    }
}

export { getWebtoons, getWebtoonDetails, registerWebtoon }