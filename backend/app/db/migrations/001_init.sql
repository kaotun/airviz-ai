-- =============================================================================
-- 001_init.sql
-- Khởi tạo schema cho AirViz.AI
-- Chạy idempotent: có thể chạy nhiều lần mà không bị lỗi
-- =============================================================================

-- Bật extension TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- =============================================================================
-- Bảng 1: provinces — Danh sách 63 tỉnh thành Việt Nam
-- =============================================================================
CREATE TABLE IF NOT EXISTS provinces (
    id          SMALLINT    PRIMARY KEY,
    slug        VARCHAR(64) NOT NULL UNIQUE,
    name        VARCHAR(128) NOT NULL,
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL
);

COMMENT ON TABLE provinces IS '63 tỉnh thành Việt Nam với tọa độ GPS';

-- =============================================================================
-- Bảng 2: env_readings — Dữ liệu đo lường môi trường theo giờ
-- =============================================================================
CREATE TABLE IF NOT EXISTS env_readings (
    time                TIMESTAMPTZ     NOT NULL,
    province_id         SMALLINT        NOT NULL REFERENCES provinces(id),

    -- Chất ô nhiễm (µg/m³)
    pm2_5               REAL,
    pm10                REAL,
    carbon_monoxide     REAL,
    nitrogen_dioxide    REAL,
    sulphur_dioxide     REAL,
    ozone               REAL,
    dust                REAL,

    -- Chỉ số AQI tổng hợp (theo chuẩn European AQI)
    european_aqi        REAL,

    -- Unique constraint để upsert idempotent
    CONSTRAINT env_readings_pkey PRIMARY KEY (time, province_id)
);

COMMENT ON TABLE env_readings IS 'Dữ liệu chất lượng không khí theo giờ từ Open-Meteo API';
COMMENT ON COLUMN env_readings.pm2_5            IS 'Bụi mịn PM2.5 (µg/m³)';
COMMENT ON COLUMN env_readings.pm10             IS 'Bụi mịn PM10 (µg/m³)';
COMMENT ON COLUMN env_readings.carbon_monoxide  IS 'Carbon Monoxide CO (µg/m³)';
COMMENT ON COLUMN env_readings.nitrogen_dioxide IS 'Nitrogen Dioxide NO2 (µg/m³)';
COMMENT ON COLUMN env_readings.sulphur_dioxide  IS 'Sulphur Dioxide SO2 (µg/m³)';
COMMENT ON COLUMN env_readings.ozone            IS 'Ozone O3 (µg/m³)';
COMMENT ON COLUMN env_readings.dust             IS 'Bụi thô (µg/m³)';
COMMENT ON COLUMN env_readings.european_aqi     IS 'Chỉ số AQI châu Âu (0–500+)';

-- Chuyển thành hypertable với chunk_time_interval = 1 tháng
SELECT create_hypertable(
    'env_readings', 'time',
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

-- =============================================================================
-- Index — Tối ưu các query thường dùng của dashboard
-- =============================================================================

-- Query theo tỉnh (bản đồ, panel chi tiết)
CREATE INDEX IF NOT EXISTS idx_env_readings_province_time
    ON env_readings (province_id, time DESC);

-- Query AQI cao nhất toàn quốc (tab Tổng quan, Cảnh báo)
CREATE INDEX IF NOT EXISTS idx_env_readings_aqi
    ON env_readings (european_aqi DESC NULLS LAST, time DESC)
    WHERE european_aqi IS NOT NULL;

-- =============================================================================
-- Continuous Aggregate: daily_aqi
-- Tính trung bình ngày cho tất cả các biến — dùng cho query 30 ngày toàn quốc
-- =============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_aqi
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time)  AS day,
    province_id,
    AVG(pm2_5)                  AS pm2_5_avg,
    AVG(pm10)                   AS pm10_avg,
    AVG(carbon_monoxide)        AS co_avg,
    AVG(nitrogen_dioxide)       AS no2_avg,
    AVG(sulphur_dioxide)        AS so2_avg,
    AVG(ozone)                  AS o3_avg,
    AVG(dust)                   AS dust_avg,
    AVG(european_aqi)           AS aqi_avg,
    MAX(european_aqi)           AS aqi_max,
    MIN(european_aqi)           AS aqi_min,
    COUNT(*)                    AS reading_count
FROM env_readings
GROUP BY day, province_id
WITH NO DATA;

COMMENT ON MATERIALIZED VIEW daily_aqi IS
    'Aggregate trung bình ngày — dùng cho query 30 ngày, tháng, quý. Cập nhật tự động.';

-- Refresh policy: tự động cập nhật daily_aqi mỗi 1 giờ
SELECT add_continuous_aggregate_policy(
    'daily_aqi',
    start_offset  => INTERVAL '3 days',
    end_offset    => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- =============================================================================
-- Bảng 3: ai_logs — Lịch sử toàn bộ vòng đời request AI
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_logs (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      VARCHAR(64),                -- ID phiên chat (frontend)
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Input
    user_message    TEXT            NOT NULL,
    context_json    JSONB,                      -- Dashboard context lúc gửi (tỉnh, metric, dateRange)

    -- Intent classification
    intent          VARCHAR(16),                -- 'query' | 'analysis' | 'codegen'

    -- Generated artifact
    generated_sql   TEXT,                       -- SQL do LLM sinh (với intent=query/analysis)
    generated_code  TEXT,                       -- Python code do LLM sinh (với intent=codegen)
    explanation     TEXT,                       -- Giải thích bằng tiếng Việt

    -- Human-in-the-loop
    status          VARCHAR(20)     NOT NULL DEFAULT 'pending',
                                                -- pending → approved / rejected → executed / failed
    approved_at     TIMESTAMPTZ,
    approved_by     VARCHAR(64),                -- user identifier (future use)

    -- Execution result
    executed_at     TIMESTAMPTZ,
    execution_ms    INTEGER,                    -- Thời gian chạy (ms)
    execution_result JSONB,                     -- {stdout, stderr, chart_base64, rows}

    -- LLM metadata
    llm_model       VARCHAR(64)     DEFAULT 'gemini-1.5-flash',
    prompt_tokens   INTEGER,
    completion_tokens INTEGER,
    retry_count     INTEGER         DEFAULT 0
);

COMMENT ON TABLE ai_logs IS 'Lịch sử toàn bộ request AI — từ câu hỏi đến kết quả thực thi';
COMMENT ON COLUMN ai_logs.status IS 'pending | approved | rejected | executed | failed';
COMMENT ON COLUMN ai_logs.context_json IS 'Dashboard context: {province, metric, dateRange}';

-- Index cho logs endpoint (pagination theo thời gian)
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at
    ON ai_logs (created_at DESC);

-- Index filter theo status (admin view)
CREATE INDEX IF NOT EXISTS idx_ai_logs_status
    ON ai_logs (status, created_at DESC);

-- =============================================================================
-- Verify — Kiểm tra schema đã tạo đúng
-- =============================================================================
DO $$
DECLARE
    tbl_count INT;
    view_count INT;
BEGIN
    SELECT COUNT(*) INTO tbl_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('provinces', 'env_readings', 'ai_logs');

    SELECT COUNT(*) INTO view_count
    FROM timescaledb_information.continuous_aggregates
    WHERE view_name = 'daily_aqi';

    IF tbl_count = 3 AND view_count = 1 THEN
        RAISE NOTICE '✓ Schema khởi tạo thành công: 3 bảng + 1 continuous aggregate';
    ELSE
        RAISE WARNING '⚠ Schema không đầy đủ: tbl_count=%, view_count=%', tbl_count, view_count;
    END IF;
END $$;
