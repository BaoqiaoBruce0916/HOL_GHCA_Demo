import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllCategories,
    getAllGames,
    getAllGameIds,
    getAllPublishers,
    getFilteredGames,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilterFixture(db: Database): Promise<{ strategyId: number; racingId: number; publisherOneId: number; publisherTwoId: number }> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'strategy games' })
        .returning({ id: categories.id });
    const [racing] = await db
        .insert(categories)
        .values({ name: 'Racing', description: 'racing games' })
        .returning({ id: categories.id });
    const [pubOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub one' })
        .returning({ id: publishers.id });
    const [pubTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'pub two' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        { title: 'Alpha Rally', description: 'Racing title', starRating: 4.4, categoryId: racing.id, publisherId: pubOne.id },
        { title: 'Beta Tactics', description: 'Strategy title', starRating: 4.8, categoryId: strategy.id, publisherId: pubOne.id },
        { title: 'Gamma Circuit', description: 'Racing title', starRating: 4.2, categoryId: racing.id, publisherId: pubTwo.id },
        { title: 'Delta Command', description: 'Strategy title', starRating: 4.6, categoryId: strategy.id, publisherId: pubTwo.id },
    ]);

    return { strategyId: strategy.id, racingId: racing.id, publisherOneId: pubOne.id, publisherTwoId: pubTwo.id };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('returns all categories and publishers in name order', async () => {
        await seedFilterFixture(db);

        expect(await getAllCategories(db)).toEqual([
            { id: expect.any(Number), name: 'Racing' },
            { id: expect.any(Number), name: 'Strategy' },
        ]);
        expect(await getAllPublishers(db)).toEqual([
            { id: expect.any(Number), name: 'Pub One' },
            { id: expect.any(Number), name: 'Pub Two' },
        ]);
    });

    it('filters games by category', async () => {
        const { strategyId } = await seedFilterFixture(db);

        const gamesByCategory = await getFilteredGames(db, { categoryIds: [strategyId] });
        expect(gamesByCategory.map((game) => game.title)).toEqual(['Beta Tactics', 'Delta Command']);
    });

    it('filters games by publisher and category together', async () => {
        const { strategyId, publisherOneId } = await seedFilterFixture(db);

        const filteredGames = await getFilteredGames(db, {
            categoryIds: [strategyId],
            publisherId: publisherOneId,
        });
        expect(filteredGames.map((game) => game.title)).toEqual(['Beta Tactics']);
    });
});
