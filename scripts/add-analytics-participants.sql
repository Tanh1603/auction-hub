-- Add participants and bids for analytics auctions

DO $$
DECLARE
    bidder1_id UUID := '61fad584-3508-40b7-95cc-4e3f1a2b8c9d';
    bidder2_id UUID := '731afa59-3c4a-4ff7-9cd7-8a2b5e4f6789';
    bidder3_id UUID := '7ebf139b-36ca-4fec-820b-9c1d3e5f7890';
    bidder4_id UUID := 'eb8544dd-2ecb-4b1d-84f5-c2a1b3e4f567';
    auction_rec RECORD;
    p_id UUID;
    now_ts TIMESTAMPTZ := NOW();
BEGIN
    -- For each analytics auction, add participants and bids
    FOR auction_rec IN 
        SELECT id, starting_price, final_sale_price 
        FROM auctions 
        WHERE code LIKE 'VNA-ANALYTICS%'
    LOOP
        -- Participant 1
        INSERT INTO auction_participants (id, user_id, auction_id, registered_at, submitted_at, documents_verified_at, deposit_paid_at, confirmed_at, checked_in_at)
        VALUES (gen_random_uuid(), bidder1_id, auction_rec.id, now_ts - INTERVAL '50 days', now_ts - INTERVAL '49 days', now_ts - INTERVAL '45 days', now_ts - INTERVAL '40 days', now_ts - INTERVAL '35 days', now_ts - INTERVAL '20 days')
        RETURNING id INTO p_id;
        
        -- Bids for participant 1
        INSERT INTO auction_bids (id, auction_id, participant_id, amount, bid_at, bid_type, is_winning_bid, is_withdrawn, is_denied, created_at, updated_at)
        VALUES 
            (gen_random_uuid(), auction_rec.id, p_id, auction_rec.starting_price * 1.05, now_ts - INTERVAL '15 days', 'manual', false, false, false, now_ts - INTERVAL '15 days', now_ts - INTERVAL '15 days'),
            (gen_random_uuid(), auction_rec.id, p_id, auction_rec.starting_price * 1.20, now_ts - INTERVAL '14 days', 'manual', false, false, false, now_ts - INTERVAL '14 days', now_ts - INTERVAL '14 days');
        
        -- Participant 2 (winner)
        INSERT INTO auction_participants (id, user_id, auction_id, registered_at, submitted_at, documents_verified_at, deposit_paid_at, confirmed_at, checked_in_at)
        VALUES (gen_random_uuid(), bidder2_id, auction_rec.id, now_ts - INTERVAL '48 days', now_ts - INTERVAL '47 days', now_ts - INTERVAL '43 days', now_ts - INTERVAL '38 days', now_ts - INTERVAL '33 days', now_ts - INTERVAL '20 days')
        RETURNING id INTO p_id;
        
        INSERT INTO auction_bids (id, auction_id, participant_id, amount, bid_at, bid_type, is_winning_bid, is_withdrawn, is_denied, created_at, updated_at)
        VALUES 
            (gen_random_uuid(), auction_rec.id, p_id, auction_rec.starting_price * 1.10, now_ts - INTERVAL '14 days' + INTERVAL '30 minutes', 'manual', false, false, false, now_ts - INTERVAL '14 days', now_ts - INTERVAL '14 days'),
            (gen_random_uuid(), auction_rec.id, p_id, auction_rec.final_sale_price, now_ts - INTERVAL '13 days', 'manual', true, false, false, now_ts - INTERVAL '13 days', now_ts - INTERVAL '13 days');
        
        -- Participant 3
        INSERT INTO auction_participants (id, user_id, auction_id, registered_at, submitted_at, documents_verified_at, deposit_paid_at, confirmed_at, checked_in_at)
        VALUES (gen_random_uuid(), bidder3_id, auction_rec.id, now_ts - INTERVAL '46 days', now_ts - INTERVAL '45 days', now_ts - INTERVAL '41 days', now_ts - INTERVAL '36 days', now_ts - INTERVAL '31 days', now_ts - INTERVAL '20 days')
        RETURNING id INTO p_id;
        
        INSERT INTO auction_bids (id, auction_id, participant_id, amount, bid_at, bid_type, is_winning_bid, is_withdrawn, is_denied, created_at, updated_at)
        VALUES 
            (gen_random_uuid(), auction_rec.id, p_id, auction_rec.starting_price * 1.15, now_ts - INTERVAL '14 days' + INTERVAL '45 minutes', 'auto', false, false, false, now_ts - INTERVAL '14 days', now_ts - INTERVAL '14 days'),
            (gen_random_uuid(), auction_rec.id, p_id, auction_rec.starting_price * 1.30, now_ts - INTERVAL '13 days' - INTERVAL '30 minutes', 'manual', false, false, false, now_ts - INTERVAL '13 days', now_ts - INTERVAL '13 days');
        
    END LOOP;
    
    RAISE NOTICE 'Added participants and bids for all analytics auctions';
END $$;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_auction_analytics;

-- Show updated results
SELECT 'Updated Analytics Auctions' as info;
SELECT 
    auction_code,
    asset_type,
    gmv,
    total_revenue,
    bid_count,
    participant_count
FROM mv_auction_analytics
WHERE auction_code LIKE 'VNA-ANALYTICS%'
ORDER BY gmv DESC;
