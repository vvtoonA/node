import { DBManager } from '../configs/db';
import { getMetadata, getOriginLink } from '../utils/MetadataUtil';
import { WebtoonRepository } from '../repositories/WebtoonRepository';
import { PlatformRepository } from '../repositories/PlatformRepository';
import { LinkRepository } from '../repositories/LinkRepository';
import { WebtoonPlatformRepository } from '../repositories/WebtoonPlatformRepository';
import { WebtoonDTO } from '../dtos/WebtoonDTO';

const dbManager = DBManager.getInstance();
const webtoonRepository = WebtoonRepository.getInstance();
const platformRepository = PlatformRepository.getInstance();
const linkRepository = LinkRepository.getInstance();
const webtoonPlatformRepository = WebtoonPlatformRepository.getInstance();

/**
 * 모든 웹툰 조회
 */
async function allWebtoons(user: string) {
    try {
        const data = await webtoonRepository.findAllWebtoonsIncludeBookmarkWithSequelize(user);
        return data.map(webtoon => {
            return new WebtoonDTO(
                webtoon.get().id,
                webtoon.get().image,
                webtoon.get().title,
                webtoon.get().author,
                webtoon.get().desc,
                webtoon.get().bookmark
            );
        });
    } catch (error) {
        console.error('웹툰 조회 실패:', error);
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

export { allWebtoons, registerWebtoon }