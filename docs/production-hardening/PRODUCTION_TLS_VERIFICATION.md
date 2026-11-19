# Sana HRMS - Production TLS Verification Report

**Version:** 1.0  
**Date:** 2026-11-19  
**Classification:** INTERNAL  

---

## 1. Executive Summary

Nginx reverse proxy is fully configured for production TLS termination with modern security standards. The configuration is ready but requires a production domain and Let's Encrypt certificates at deployment time.

**Status:** ✅ Configuration Complete — ⚠️ Requires Production Domain & Certificates

---

## 2. Nginx TLS Configuration

### 2.1 File Location
- **Main Config:** `proxy/nginx.conf`
- **Certificates Directory:** `proxy/certs/` (empty, mounted at runtime)
- **ACME Challenge Root:** `/var/www/certbot`

### 2.2 TLS Parameters

| Parameter | Value | Standard |
|-----------|-------|----------|
| **Protocols** | TLSv1.2, TLSv1.3 | ✅ Modern |
| **Cipher Suite** | ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384 | ✅ Mozilla Modern |
| **Prefer Server Ciphers** | off | ✅ Client preference |
| **SSL Session Cache** | shared:SSL:10m | ✅ |
| **SSL Session Timeout** | 10m | ✅ |
| **SSL Session Tickets** | off | ✅ Forward Secrecy |

---

## 3. Security Features

### 3.1 HTTP → HTTPS Redirect
```nginx
server {
    listen 80;
    server_name _;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}
```

### 3.2 HSTS (HTTP Strict Transport Security)
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```
- **Max-Age:** 1 year (31536000 seconds)
- **includeSubDomains:** ✅
- **preload:** ✅ (eligible for HSTS preload list)

### 3.3 OCSP Stapling
```nginx
ssl_stapling on;
ssl_stapling_verify on;
resolver 1.1.1.1 8.8.8.8 valid=300s;
resolver_timeout 5s;
```

### 3.3 Security Headers
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
```

---

## 4. Certificate Management

### 4.1 Expected Certificate Files
```
/etc/nginx/certs/
├── fullchain.pem      # Certificate + chain
├── privkey.pem        # Private key
└── chain.pem          # CA chain (for OCSP stapling)
```

### 4.2 Let's Encrypt Production Issuance

**Prerequisites:**
- Production domain (e.g., `sana-hrms.company.com`)
- DNS A/AAAA record pointing to production IP
- Port 80/443 accessible from internet

**Issuance Command:**
```bash
# Using certbot (run on host or in certbot container)
certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d sana-hrms.company.com \
  --email admin@company.com \
  --agree-tos \
  --no-eff-email \
  --force-renewal
```

**Certificate Paths:**
```bash
# Symlink to nginx certs directory
ln -sf /etc/letsencrypt/live/sana-hrms.company.com/fullchain.pem /path/to/proxy/certs/fullchain.pem
ln -sf /etc/letsencrypt/live/sana-hrms.company.com/privkey.pem /path/to/proxy/certs/privkey.pem
ln -sf /etc/letsencrypt/live/sana-hrms.company.com/chain.pem /path/to/proxy/certs/chain.pem
```

### 4.3 Auto-Renewal

```bash
# Cron job (run daily at 3 AM)
0 3 * * * certbot renew --quiet --post-hook "docker compose -f /path/to/docker-compose.yml -f /path/to/docker-compose.prod.yml restart proxy"
```

---

## 5. Nginx Security Configuration

### 5.1 Rate Limiting
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=upload:10m rate=10r/s;
```

### 5.2 Applied Rate Limits
| Endpoint | Zone | Rate | Burst |
|----------|------|------|-------|
| `/api/` | api | 100r/s | 200 |
| `/api/v1/auth/*` | auth | 5r/s | 10 |
| `/api/v1/documents/`, `/api/v1/uploads/` | upload | 10r/s | 20 |

### 5.3 Secure Cookies
```nginx
proxy_cookie_path / "/; Secure; HttpOnly; SameSite=Strict";
```

---

## 6. Deployment Checklist

| Item | Status | Notes |
|------|--------|-------|
| Nginx config (`proxy/nginx.conf`) | ✅ Complete | TLS 1.2/1.3, HSTS, OCSP, CSP |
| Certificates directory | ✅ Ready | `proxy/certs/` exists |
| ACME challenge root | ✅ Configured | `/var/www/certbot` in nginx |
| **Production domain** | ❌ **Missing** | Requires org action |
| **DNS A record** | ❌ **Missing** | Requires org action |
| **Let's Encrypt certs** | ❌ **Missing** | Requires domain + issuance |
| **Auto-renewal cron** | ⏳ Pending | Requires domain first |
| **SSL Labs A+ target** | ⏳ Pending | Requires certs |

---

## 5. Pre-Deployment Verification

### 5.1 Configuration Test
```bash
# Test nginx config syntax
docker run --rm -v $(pwd)/proxy/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t

# Expected: syntax is ok, test is successful
```

### 6.2 Post-Deployment Verification

```bash
# 1. Check certificate validity
openssl s_client -connect sana-hrms.company.com:443 -servername sana-hrms.company.com < /dev/null

# 2. Check HSTS header
curl -I https://sana-hrms.company.com | grep -i strict-transport-security

# 3. Check OCSP Stapling
openssl s_client -connect sana-hrms.company.com:443 -servername sana-hrms.company.com -status < /dev/null

# 4. SSL Labs Test
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=sana-hrms.company.com
# Target: Grade A+
```

---

## 7. Current Status

| Item | Status | Blockers |
|------|--------|----------|
| Nginx TLS Config | ✅ Complete | — |
| Security Headers | ✅ Complete | — |
| Rate Limiting | ✅ Complete | — |
| OCSP Stapling | ✅ Configured | — |
| HSTS with Preload | ✅ Configured | — |
| **Production Domain** | ❌ **Missing** | Org action required |
| **DNS Record** | ❌ **Missing** | Org action required |
| **Let's Encrypt Certs** | ❌ **Missing** | Requires domain |
| Auto-Renewal | ⏳ Pending | Requires certs |

---

## 6. Blockers

**BLOCKER-CRIT-007:** Production TLS certificates not provisioned.

**Required Actions:**
1. Organization provides production domain (e.g., `sana-hrms.company.com`)
2. DevOps creates DNS A record pointing to production IP
3. DevOps runs Let's Encrypt issuance (certbot)
4. Certificates mounted to `proxy/certs/` directory
5. Proxy container restarted

**Impact Without Certificates:** No HTTPS in production — browser warnings, credential theft risk, compliance violation.

---

**Document Version:** 1.0  
**Date:** 2026-11-19  
**Status:** Configuration Complete — Blocked on External Dependencies  
**Classification:** INTERNAL