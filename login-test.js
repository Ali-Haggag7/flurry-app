import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    // 50 يوزر بيحاولوا يجيبوا البروفايل في نفس الوقت
    vus: 50,
    duration: '30s',
};

export default function () {
    // 1. رابط الـ Profile (تأكد إن البورت 4000 هو بتاع الباك إند)
    const url = 'http://127.0.0.1:4000/api/user/me';

    // 2. هنا بنحط التوكن عشان السيرفر يرضى يدخلك
    const params = {
        headers: {
            'Content-Type': 'application/json',
            // 👇👇👇 الصق التوكن الطويل بتاعك هنا بين علامات التنصيص
            'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18zM3Q1akRDSWhFYTJmc3lGTXVoWGRqUnRab1UiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjQxNzMiLCJleHAiOjE3NjkzMzk5OTIsImZ2YSI6WzI2MDIsLTFdLCJpYXQiOjE3NjkzMzk5MzIsImlzcyI6Imh0dHBzOi8vbW9kZXJuLWVtdS01MS5jbGVyay5hY2NvdW50cy5kZXYiLCJuYmYiOjE3NjkzMzk5MjIsInNpZCI6InNlc3NfMzhmSFpraTFYNkQ2a2RiQzI2dzdmVGdkbXpEIiwic3RzIjoiYWN0aXZlIiwic3ViIjoidXNlcl8zNUNGZktNaEtKcGpOR3NsUVpNRGw3MFQ3N1IiLCJ2IjoyfQ.JQ6zDtThKtRwCucJDy-R2jneTScKSefneVDPocCLNhihzmQFPP4UCW4OhMmd69uURk_hChs85qJzuAIEiEKxraX-cwo07mwhYzdKWA4ToqANAUHzZlTKrS48Ly0f5izrl1pSN5XMxDa1ZMKUu-DaHyLkhx7zH1jdMyAD7AhCdo42RmjRqFR8HvlWF2eEiekEu2LrNBeO7OZw0I40crkPqETQARv6inrc5p2ttwUGiC2Hi5abWjatOpxTIW-Bv_rN1m-1QsYa6ASfCFEoNyMTwU2MAGD_zWY7Yc7xH6IlscjLN5oFhkBDlh258PG1dGPYthwEN34LTPqcG0VhSnABUg',
        },
    };

    // المرة دي GET لأننا بنطلب بيانات البروفايل
    const res = http.get(url, params);

    check(res, {
        // المفروض يرد بـ 200 ويرجع بيانات اليوزر
        'Status is 200 (Authorized)': (r) => r.status === 200,
        // نتأكد إنه سريع
        'Response time < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
}