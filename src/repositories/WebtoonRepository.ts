import type { Transaction } from "sequelize";
import type { RegisterDTO } from "../dtos/WebtoonDTO";
import { bookmarkS, webtoonS } from "../models/sequelize";

class WebtoonRepository {

    private static instance: WebtoonRepository;

    private constructor() { }

    public static getInstance(): WebtoonRepository {
        if (this.instance == null) this.instance = new WebtoonRepository();
        return this.instance;
    }

    public async findAllWebtoonsIncludeBookmarkWithSequelize(user: string) {
        return await webtoonS.findAll({
            include: [{
                model: bookmarkS,
                where: { user },
                required: false
            }]
        });
    }

    public async findWebtoonByTitleWithSequelize(title: string) {
        return await webtoonS.findOne({ where: { title } })
    }

    public async saveWithSequelize(data: RegisterDTO, transaction: Transaction) {
        return await webtoonS.create({
            image: data.getWebtoon().getImage(),
            title: data.getWebtoon().getTitle(),
            author: data.getWebtoon().getAuthor(),
            desc: data.getWebtoon().getDesc()
        }, { transaction });
    }
}

export { WebtoonRepository }