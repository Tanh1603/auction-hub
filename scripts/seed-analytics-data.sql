-- Simple seed script for analytics data
-- Insert 6 finalized auctions with complete financial data

-- Auction 1: High value villa
INSERT INTO auctions (
    id, name, code, property_owner, 
    sale_start_at, sale_end_at, sale_fee, view_time,
    deposit_end_at, deposit_amount_required,
    auction_start_at, auction_end_at,
    asset_description, asset_address,
    valid_check_in_before_start_minutes, valid_check_in_after_start_minutes,
    starting_price, bid_increment, asset_type, status,
    asset_ward_id, asset_province_id,
    final_sale_price, commission_fee, dossier_fee_snapshot,
    starting_price_snapshot, deposit_amount_snapshot,
    net_amount_to_property_owner, financial_calculated_at,
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'Biet thu mat bien My Khe - High Value',
    'VNA-ANALYTICS-001',
    '{"name": "Company A", "phone": "0236555666"}'::jsonb,
    NOW() - INTERVAL '50 days', NOW() - INTERVAL '25 days', 100000000, '8:00-17:00',
    NOW() - INTERVAL '30 days', 2000000000,
    NOW() - INTERVAL '20 days', NOW() - INTERVAL '14 days',
    'Biet thu mat bien dien tich 1000m2',
    '199 Vo Nguyen Giap Da Nang',
    30, 15,
    20000000000, 500000000, 'other_asset', 'success',
    437, 436,
    28500000000.00, 1425000000.00, 10000000.00,
    20000000000.00, 2000000000.00,
    27065000000.00, NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '75 days', NOW()
);

-- Auction 2: Land use rights
INSERT INTO auctions (
    id, name, code, property_owner, 
    sale_start_at, sale_end_at, sale_fee, view_time,
    deposit_end_at, deposit_amount_required,
    auction_start_at, auction_end_at,
    asset_description, asset_address,
    valid_check_in_before_start_minutes, valid_check_in_after_start_minutes,
    starting_price, bid_increment, asset_type, status,
    asset_ward_id, asset_province_id,
    final_sale_price, commission_fee, dossier_fee_snapshot,
    starting_price_snapshot, deposit_amount_snapshot,
    net_amount_to_property_owner, financial_calculated_at,
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'Quyen su dung dat Lo A1 - Da Nang',
    'VNA-ANALYTICS-002',
    '{"name": "Company B", "phone": "0236123456"}'::jsonb,
    NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days', 50000000, '8:00-17:00',
    NOW() - INTERVAL '40 days', 500000000,
    NOW() - INTERVAL '35 days', NOW() - INTERVAL '32 days',
    'Lo dat rong 500m2 tai quan Hai Chau',
    '45 Tran Phu Hai Chau Da Nang',
    30, 15,
    5000000000, 100000000, 'land_use_rights', 'success',
    437, 436,
    7500000000.00, 375000000.00, 5000000.00,
    5000000000.00, 500000000.00,
    7120000000.00, NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '90 days', NOW()
);

-- Auction 3: Secured asset (car)
INSERT INTO auctions (
    id, name, code, property_owner, 
    sale_start_at, sale_end_at, sale_fee, view_time,
    deposit_end_at, deposit_amount_required,
    auction_start_at, auction_end_at,
    asset_description, asset_address,
    valid_check_in_before_start_minutes, valid_check_in_after_start_minutes,
    starting_price, bid_increment, asset_type, status,
    asset_ward_id, asset_province_id,
    final_sale_price, commission_fee, dossier_fee_snapshot,
    starting_price_snapshot, deposit_amount_snapshot,
    net_amount_to_property_owner, financial_calculated_at,
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'Tai san dam bao - Toyota Camry 2022',
    'VNA-ANALYTICS-003',
    '{"name": "Bank C", "phone": "0236789012"}'::jsonb,
    NOW() - INTERVAL '45 days', NOW() - INTERVAL '20 days', 10000000, '9:00-16:00',
    NOW() - INTERVAL '25 days', 50000000,
    NOW() - INTERVAL '22 days', NOW() - INTERVAL '20 days',
    'Xe Toyota Camry 2.5Q nam 2022 mau den',
    '78 Nguyen Huu Tho Cam Le Da Nang',
    30, 15,
    800000000, 20000000, 'secured_asset', 'success',
    445, 436,
    1150000000.00, 57500000.00, 2000000.00,
    800000000.00, 50000000.00,
    1090500000.00, NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '60 days', NOW()
);

-- Auction 4: State asset
INSERT INTO auctions (
    id, name, code, property_owner, 
    sale_start_at, sale_end_at, sale_fee, view_time,
    deposit_end_at, deposit_amount_required,
    auction_start_at, auction_end_at,
    asset_description, asset_address,
    valid_check_in_before_start_minutes, valid_check_in_after_start_minutes,
    starting_price, bid_increment, asset_type, status,
    asset_ward_id, asset_province_id,
    final_sale_price, commission_fee, dossier_fee_snapshot,
    starting_price_snapshot, deposit_amount_snapshot,
    net_amount_to_property_owner, financial_calculated_at,
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'Thiet bi van phong thanh ly - So Tai chinh',
    'VNA-ANALYTICS-004',
    '{"name": "Dept D", "phone": "0236111222"}'::jsonb,
    NOW() - INTERVAL '30 days', NOW() - INTERVAL '10 days', 5000000, '8:00-11:30',
    NOW() - INTERVAL '15 days', 10000000,
    NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days',
    'Lo thiet bi van phong 20 may tinh 10 may in',
    '29 Tran Phu Hai Chau Da Nang',
    30, 15,
    100000000, 5000000, 'state_asset', 'success',
    460, 436,
    185000000.00, 9250000.00, 1000000.00,
    100000000.00, 10000000.00,
    174750000.00, NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '45 days', NOW()
);

-- Auction 5: Enforcement asset
INSERT INTO auctions (
    id, name, code, property_owner, 
    sale_start_at, sale_end_at, sale_fee, view_time,
    deposit_end_at, deposit_amount_required,
    auction_start_at, auction_end_at,
    asset_description, asset_address,
    valid_check_in_before_start_minutes, valid_check_in_after_start_minutes,
    starting_price, bid_increment, asset_type, status,
    asset_ward_id, asset_province_id,
    final_sale_price, commission_fee, dossier_fee_snapshot,
    starting_price_snapshot, deposit_amount_snapshot,
    net_amount_to_property_owner, financial_calculated_at,
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'Tai san thi hanh an - Can ho Monarchy',
    'VNA-ANALYTICS-005',
    '{"name": "Court E", "phone": "0236444555"}'::jsonb,
    NOW() - INTERVAL '25 days', NOW() - INTERVAL '8 days', 20000000, '9:00-16:00',
    NOW() - INTERVAL '10 days', 200000000,
    NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days',
    'Can ho chung cu cao cap Monarchy tang 25 dien tich 120m2',
    'Monarchy An Duong Vuong Son Tra Da Nang',
    30, 15,
    3500000000, 50000000, 'enforcement_asset', 'success',
    445, 436,
    4200000000.00, 210000000.00, 3000000.00,
    3500000000.00, 200000000.00,
    3987000000.00, NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '40 days', NOW()
);

-- Auction 6: Administrative violation asset
INSERT INTO auctions (
    id, name, code, property_owner, 
    sale_start_at, sale_end_at, sale_fee, view_time,
    deposit_end_at, deposit_amount_required,
    auction_start_at, auction_end_at,
    asset_description, asset_address,
    valid_check_in_before_start_minutes, valid_check_in_after_start_minutes,
    starting_price, bid_increment, asset_type, status,
    asset_ward_id, asset_province_id,
    final_sale_price, commission_fee, dossier_fee_snapshot,
    starting_price_snapshot, deposit_amount_snapshot,
    net_amount_to_property_owner, financial_calculated_at,
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'Tang vat vi pham hanh chinh - Lo hang dien tu',
    'VNA-ANALYTICS-006',
    '{"name": "Customs F", "phone": "0236888999"}'::jsonb,
    NOW() - INTERVAL '20 days', NOW() - INTERVAL '5 days', 8000000, '8:30-16:30',
    NOW() - INTERVAL '7 days', 30000000,
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day',
    'Lo hang dien tu 100 dien thoai 50 tablet 30 laptop',
    'Kho bai Hai quan Cang Tien Sa Son Tra Da Nang',
    30, 15,
    300000000, 10000000, 'administrative_violation_asset', 'success',
    460, 436,
    520000000.00, 26000000.00, 1500000.00,
    300000000.00, 30000000.00,
    492500000.00, NOW() - INTERVAL '12 hours',
    NOW() - INTERVAL '30 days', NOW()
);

-- Get auction IDs for participants and bids
DO $$
DECLARE
    bidder1_id UUID := '61fad584-3508-40b7-95cc-4e3f1a2b8c9d';
    bidder2_id UUID := '731afa59-3c4a-4ff7-9cd7-8a2b5e4f6789';
    bidder3_id UUID := '7ebf139b-36ca-4fec-820b-9c1d3e5f7890';
    bidder4_id UUID := 'eb8544dd-2ecb-4b1d-84f5-c2a1b3e4f567';
    auction_rec RECORD;
    p_id UUID;
BEGIN
    -- For each analytics auction, add participants and bids
    FOR auction_rec IN 
        SELECT id, starting_price, final_sale_price 
        FROM auctions 
        WHERE code LIKE 'VNA-ANALYTICS%'
    LOOP
        -- Add 3-4 participants per auction
        INSERT INTO auction_participants (id, user_id, auction_id, registered_at, submitted_at, documents_verified_at, deposit_paid_at, confirmed_at, checked_in_at)
        VALUES (gen_random_uuid(), bidder1_id, auction_rec.id, NOW() - INTERVAL '50 days', NOW() - INTERVAL '49 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '40 days', NOW() - INTERVAL '35 days', NOW() - INTERVAL '20 days')
        RETURNING id INTO p_id;
        
        -- Add bids for this participant
        INSERT INTO auction_bids (id, auction_id, participant_id, amount, bid_at, bid_type, is_winning_bid)
        VALUES 
            (gen_random_uuid(), auction_rec.id, p_id, auction_rec.starting_price * 1.05, NOW() - INTERVAL '15 days', 'manual', false),
            (gen_random_uuid(), auction_rec.id, p_id, auction_rec.starting_price * 1.20, NOW() - INTERVAL '14 days', 'manual', false);
        
        -- Second participant
        INSERT INTO auction_participants (id, user_id, auction_id, registered_at, submitted_at, documents_verified_at, deposit_paid_at, confirmed_at, checked_in_at)
        VALUES (gen_random_uuid(), bidder2_id, auction_rec.id, NOW() - INTERVAL '48 days', NOW() - INTERVAL '47 days', NOW() - INTERVAL '43 days', NOW() - INTERVAL '38 days', NOW() - INTERVAL '33 days', NOW() - INTERVAL '20 days')
        RETURNING id INTO p_id;
        
        INSERT INTO auction_bids (id, auction_id, participant_id, amount, bid_at, bid_type, is_winning_bid)
        VALUES 
            (gen_random_uuid(), auction_rec.id, p_id, auction_rec.starting_price * 1.10, NOW() - INTERVAL '15 days', 'manual', false),
            (gen_random_uuid(), auction_rec.id, p_id, auction_rec.final_sale_price, NOW() - INTERVAL '13 days', 'manual', true);
        
        -- Third participant
        INSERT INTO auction_participants (id, user_id, auction_id, registered_at, submitted_at, documents_verified_at, deposit_paid_at, confirmed_at, checked_in_at)
        VALUES (gen_random_uuid(), bidder3_id, auction_rec.id, NOW() - INTERVAL '46 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '41 days', NOW() - INTERVAL '36 days', NOW() - INTERVAL '31 days', NOW() - INTERVAL '20 days')
        RETURNING id INTO p_id;
        
        INSERT INTO auction_bids (id, auction_id, participant_id, amount, bid_at, bid_type, is_winning_bid)
        VALUES 
            (gen_random_uuid(), auction_rec.id, p_id, auction_rec.starting_price * 1.15, NOW() - INTERVAL '14 days', 'auto', false);
        
    END LOOP;
    
    RAISE NOTICE 'Added participants and bids for all analytics auctions';
END $$;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_auction_analytics;

-- Show results
SELECT 'Analytics Data Summary' as info;
SELECT 
    status,
    COUNT(*) as count,
    COALESCE(SUM(gmv), 0) as total_gmv,
    COALESCE(SUM(total_revenue), 0) as total_revenue
FROM mv_auction_analytics
GROUP BY status;

SELECT 'Analytics Auctions Detail' as info;
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
