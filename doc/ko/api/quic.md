# QUIC

원문: [`doc/api/quic.md`](../../api/quic.md)

<!-- introduced_in=v23.8.0-->

<!-- YAML
added: v23.8.0
-->

> 안정성: 1.0 - 초기 개발

<!-- source_link=lib/quic.js -->

'node:quic' 모듈은 QUIC 프로토콜의 구현을 제공합니다.
액세스하려면 `--experimental-quic` 옵션을 사용하여 Node.js를 시작하십시오.

```mjs
import quic from 'node:quic';
```

```cjs
const quic = require('node:quic');
```

모듈은 `node:` 스킴에서만 사용할 수 있습니다.

## 개요

`quic` 모듈은 QUIC 클라이언트와 서버를 만드는 API를 제공합니다.

## 관련 RFC 및 사양

QUIC 및 HTTP/3 프로토콜은 RFC의 수집에 의해 정의됩니다.
IETF QUIC 작업 그룹에 의해 주로. 이 문서에 익숙함
이 모듈의 사용자에게 강력하게 권장됩니다.

**핵심 QUIC 전송:**

* [RFC 8999][] - QUIC의 버전 독립 속성
* [RFC 9000][] - QUIC : UDP 기반 다중 및 보안 전송
* [RFC 9001][] - TLS를 사용하여 QUIC을 확보
* [RFC 9002][] - QUIC 손실 탐지 및 혼잡 통제

**핵심 HTTP/3 :**

* [RFC 9114][] - HTTP/3
* [RFC 9204][] - QPACK : HTTP/3 필드 압축

**QUIC 확장:**

* [RFC 9221][] - QUIC에 Unreliable Datagram 연장
* [RFC 9287][] - QUIC 비트를 올리기
* [RFC 9368][] - QUIC를 위한 호환성 버전 양도
* [RFC 9369][] - QUIC 버전 2
* [RFC 9443][] - QUIC를 위한 다중화 계획 업데이트

**HTTP/3 확장:**

* [RFC 9218][] - HTTP의 Extensible Prioritization Scheme
* [RFC 9220][] - HTTP/3과 웹소켓을 부팅
* [RFC 9297][] - HTTP 데이터그램 및 캡슐 프로토콜
* [RFC 9412][] - HTTP/3의 ORIGIN 확장

**관련 및 정보:**

* [RFC 9308][] - QUIC 전송 프로토콜의 적용성
* [RFC 9312][] - QUIC 전송 프로토콜의 관리

## 아키텍처

`quic` 모듈는 3개의 핵심 요약의 주위에 건축됩니다:

* `QuicEndpoint`: QUIC의 로컬 UDP 소켓 바인딩을 나타냅니다. 그것은
QUIC 패킷을 보내고 여러 곳에서 공유할 수 있습니다.
세션. 단일 엔드포인트는 클라이언트와 서버 모두 사용할 수 있습니다.
동시.

* `QuicSession`: 로컬 엔드포인트와 QUIC 연결을 나타냅니다.
원격 피어. 세션은 연결을 시작해서
`quic.connect()`를 사용하여 원격 피어 또는 들어오는 연결을 수락
`quic.listen()`를 통해 원격 피어에서.

* `QuicStream`: 세션 내에서 QUIC 스트림을 나타냅니다. 스트림은
로컬 또는 원격 피어에 의해 생성하고 양방향 또는 일 수 있습니다
단방향성.

전통적인 TCP 기반 프로토콜과는 달리 QUIC "connections"는 의도하지 않습니다.
특정 로컬 포트 / 원격 포트 쌍에 묶여. 세션이 시작되었습니다.
QUIC 엔드포인트는 다른 로컬 또는 원격 주소로 마이그레이션할 수 있습니다.
일생에, 그것을 창조한 endpoint를 능가하고, 조차 일지도 모릅니다
다중 엔드포인트와 동시에 관련. 이 융통성은 허용합니다
연결 이동과 같은 고급 사용 케이스, 멀티 호밍, 및 로드 균형.
가장 자주, 그러나, 단점과 세션 사이에 간단한 하나 하나에 1개의 관계
충분합니다.

## 통합 TLS 1.3

QUIC 프로토콜은 연결을위한 프로토콜로 TLS 1.3을 직접 통합합니다.
설립 및 보안. `quic` 모듈의 API는 이 통합을 반영합니다.
TLS 관련 정보 및 구성 옵션을 exposing함으로써. 현재 위치
TLS없이 QUIC을 사용하거나 TLS의 다른 버전을 사용할 수 없습니다.

모든 QUIC 세션은 클라이언트와 서버가 TLS Handhake를 수행
Application Protocol (via ALPN)을 협상하여 서버 인증 (및
선택적으로 클라이언트), 교환 전송 모수, 및 공유한 열쇠를 설치하십시오
암호화.

### 인증서 크기와 핸드셰이크 성과

QUIC는 항암제 제한([RFC 9000 Section 8.1][])을 포함합니다.
서버가 3배로 전송하는 것을 제한합니다.
클라이언트의 주소가 유효하다. 고객의
초기 패킷은 일반적으로 약 1200 바이트, 서버는 대부분에서 보낼 수 있습니다
약 3600 바이트 전에 승인 할 클라이언트를 기다립니다.

서버의 초기 응답은 TLS 인증서 체인에 의해 지배됩니다. 
인증서 사슬은 증폭 한계를 초과합니다, 핸드셰이크는 요구합니다
추가 라운드 여행 - 서버는 일시 중지해야합니다, 클라이언트의 기다립니다
인정, 그리고 계속 인증서의 나머지 부분을 보내.
이것은 TCP+TLS에 QUIC의 1-RTT 핸드셰이크 이점을 삭제하고 추가할 수 있습니다
네트워크에 따라 첫 번째 연결에 50 ~ 100m 이상의 대기 시간
경로.

이를 피하기 위해 서버는 컴팩트 한 인증서 체인을 사용해야합니다.

***RSA보다 ECDSA 인증서**(P-256 또는 P-384). ECDSA 키와
서명은 크게 작습니다. 전형적인 ECDSA P-256 인증서 사슬
1개의 중간으로 대략 1.5-2 KB, 증폭 안에 잘 입니다
제한 사항 동등한 RSA-2048 사슬은 수시로 그것을 초과할지도 모르다 3–5 KB입니다.

***인증서 체인을 최소화합니다.**잎 인증서만 포함
필요한 중간(s). 루트 인증서를 포함하지 마십시오 (clients
이미 신뢰 가게에 있습니다. 교차 서명된 중간물을 피하십시오
자체 서명 된 루트는 이미 널리 신뢰할 수 있습니다.

***짧은 사슬을 가진 인증서 당국.**몇몇 CAs 문제점
단일 작은 중간체를 가진 인증서는, 다른 사람은 다수 요구합니다
큰 RSA 중간물. CA의 선택은 직접 핸드셰이크 대기 시간에 영향을줍니다.

인증서 압축 ([RFC 8879][])도 이 문제를 해결할 수 있습니다
Handhake에서 인증서 체인을 압축합니다. 하지만 Node.js는
현재 TLS 인증서 압축을 지원하지 않습니다.

### 비율 제한

QUIC endpoints는 내장 비율을 포함합니다
denial-of-service 공격. 방어의 2개의 층이 있습니다:

**Global Rate limits**는 stateless 응답의 총 비율을 캡
endpoint는 소스 주소에 관계없이 보낼 것입니다. 이 보호
spoofed 소스 IP 주소에서 홍수, 공격자는 통해 회전
많은 가짜 소스 주소는 per-host 제한을 우회합니다. 4가지 유형의 stateless
응답은 자주적으로 제한됩니다:

***Retry Packs**— 연결 중에 클라이언트의 주소를 유효하게 전송
설치. [`endpointOptions.retryRate`][]를 통해 구성 가능
[`endpointOptions.retryBurst`][].의 특징
***Stateless 재설정 패킷**— endpoint가 패킷을 수신할 때 전송
알 수없는 세션. [`endpointOptions.statelessResetRate`][]를 통해 구성 가능
그리고 [`endpointOptions.statelessResetBurst`][].
***Version 협상 패킷**— 클라이언트가 지원되지 않은 QUIC를 사용할 때 전송
버전. [`endpointOptions.versionNegotiationRate`][]를 통해 구성 가능
[`endpointOptions.versionNegotiationBurst`][].
***Immediate 연결 닫기 패킷**- 서버가 바쁠 때 전송
토큰은 유효하지 않습니다. [`endpointOptions.immediateCloseRate`][]를 통해 구성 가능
그리고 [`endpointOptions.immediateCloseBurst`][].

각 비율 한계는 토큰 물통을 이용합니다: 엔드포인트는 파열까지 보낼 수 있습니다
즉시 용량 및 초당 구성 비율에 토큰 리필. 시간 :
버킷은 빈, 그 유형의 추가 응답은 조용히 떨어졌다.
기본값(초당 100, 파열 200)은 대부분의 배포에 적합합니다.

**Per-host 세션 생성 속도 제한**단일 원격 주소를 얼마나 빨리 캡
새로운 세션을 만들 수 있습니다. 이것은 유효한 먼 주소 당 추적되고
세션(rapidly connect and
끊기) 서버 리소스를 소비합니다. Configurable를 통해
[`endpointOptions.sessionCreationRate`][] 및
[`endpointOptions.sessionCreationBurst`][].의 특징 기본값(초당 50, 파열)
100)는 합법적인 교통 패턴에 충분히 관대합니다. 벤치마킹
트래픽이 단일 소스에서 제공되는 시나리오는 이러한 값을 증가시킵니다.

제한 속도 외에도 endpoint는**동시 연결을 지원합니다.
`maxConnectionsPerHost` 및 `maxConnectionsTotal`를 통해 제한**,
**버스 모드**[`endpoint.busy`][]를 통해 모든 새로운 연결을 거부합니다.

속도 제한 활동은 endpoint의 통계를 통해 감시될 수 있습니다
객체. 각 비율 limiter에는 대응 카운터가 있습니다
(예: `endpoint.stats.retryRateLimited`,
많은 응답을 추적하는 `endpoint.stats.sessionCreationRateLimited`)
떨어졌다. non-zero 값은 rate limiter를 적극적으로 나타냅니다.
endpoint를 보호합니다.

### 블록 목록

Endpoints는 소스 주소를 사용하여 들어오는 패킷을 필터링할 수 있습니다.
[`net.BlockList`][] . 블록 목록은 QUIC 처리 전에 검사됩니다.
발생, 그래서 차단 된 패킷은 체크 자체를 넘어 리소스를 소비.

**Deny**모드 (기본값)에서, 목록의 주소에서 패킷은 떨어졌다:

```mjs
import { BlockList } from 'node:net';
import { listen } from 'node:quic';

const blocked = new BlockList();
blocked.addSubnet('192.168.1.0', 24);  // Block an entire subnet
blocked.addAddress('10.0.0.5');        // Block a specific address

const endpoint = await listen(onSession, {
  endpoint: {
    blockList: blocked,
    blockListPolicy: 'deny',
  },
  // ...
});
```

**allow**모드는 목록의 주소만 허용됩니다:

```mjs
const trusted = new BlockList();
trusted.addSubnet('10.0.0.0', 8);

const endpoint = await listen(onSession, {
  endpoint: {
    blockList: trusted,
    blockListPolicy: 'allow',
  },
  // ...
});
```

블록 목록은 라이브 평가 - endpoint 후 추가 또는 제거
즉시 생성된 효력. `endpoint.stats.packetsBlocked`의 특징
카운터는 많은 패킷이 필터로 떨어졌다는 것을 추적합니다.

### 신청

`QuicSession`는 단일 응용 프로그램 프로토콜과 관련되어 협상
TLS Handhake 도중 ALPN를 통해. `quic` 모듈은 설계되어
일반적으로 응용 프로그램-agnostic하지만 HTTP/3의 내장 지원이 포함되어 있습니다.
특정한 신청 의정서. HTTP/3을 사용할 때, `quic` 모듈은
헤더, 트레일러와 같은 HTTP/3-specific 기능을 처리하기위한 추가 API,
관련 기사 다른 응용 프로그램 프로토콜의 경우 사용자는
핵심 QUIC 전송 특징의 정상에 자신의 메시지 짜맞추고 다중화.

TLS Handhake를 시작하면 클라이언트는 지원된 목록을 포함합니다
`ClientHello`의 ALPN 프로토콜. 서버는 이러한 프로토콜 중 하나를 선택합니다.
(모든 경우) `ServerHello`에 포함. 협상 된 프로토콜은 결정
`QuicSession` 및 `QuicStream` API가 어떻게 동작하는지. 예를 들어, `h3`
의정서는 HTTP/3, `QuicSession` 및 `QuicStream`를 위해 협상됩니다
HTTP/3 별 기능.

현재 `quic` 모듈은 내장 애플리케이션 프로토콜로 HTTP/3을 지원합니다.
다른 모든 프로토콜은 제공된 JavaScript의 상단에 사용자에 의해 구현되어야 합니다.
API.

### 윤곽

QUIC API는 유연하고 높은 구성이 가능하도록 설계되었습니다.
사용 사례의 범위. 사용자는 QUIC 전송의 각종 측면을 구성할 수 있습니다,
TLS Handhake 및 `quic.connect()`에 전달되는 옵션을 통해 응용 활동
그리고 `quic.listen()` 기능뿐만 아니라 `QuicEndpoint` 및
`QuicSession` 인스턴스. API는 또한 상세한 통계에 접근하고 있습니다
모니터링 및 디버깅을위한 이벤트.

QUIC 전송 모수는 협상하는 TLS 핸드셰이크 도중 교환됩니다
최대 스트림 카운트와 같은 다양한 전송 수준 설정, idle timeouts,
datagram 지원 `quic` 모듈은 사용자가 전송을 구성할 수 있습니다.
매개 변수 그들의 endpoint는 피어에게 광고, 뿐만 아니라 전송에 액세스
매개변수는 피어에 의해 광고했습니다. 이 기능 및 한계를 구성합니다.
피어들과의 조화를 이루는 QUIC 연결.

로컬 설정의 풍부한 설정도 설정할 수 있습니다.
로컬 엔드포인트 및 세션. 연결 제한의 설정을 포함,
혼잡 제어, 스트림 우선화, 그리고 더.

## 콜백과 약속

`quic` 모듈은 콜백의 조합을 사용하고 비동시성을 약속합니다.
작업. 예를 들어, `quic.connect()`와 연결 시작
설치 세션에 대한 약속, 서버에서 수신 세션
측은 `quic.listen()`에 통과된 콜백을 통해 취급됩니다. 세션 내에서,
수신 스트림, 데이터그램, 세션 상태 변경 등과 같은 이벤트가 처리됩니다.
`QuicSession` 인스턴스의 콜백을 통해. Promise는 작업에 사용됩니다.
TLS Handhake 또는 완료와 같은 명확한 완료 지점이
세션의 우아한 마감.

모든 콜백은 비동기적으로 호출되며 비동기적으로 반환하거나
약속을 반환합니다. 콜백이 거부하는 약속을 반환하거나 오류를 던져,
객체는 `onerror` 콜백이면 오류로 파괴됩니다.
지정되지 않습니다.

### 스트림

스트림은 QUIC의 기본 데이터 수집 요약입니다. 스트림이 될 수 있습니다
로컬 엔드 포인트 또는 원격 피어가 세션을 한 번 시작
설치.

Streams는 양방향(data flow in both direction) 또는
단방향 (데이터는 한 방향으로 흐릅니다). `quic` 모듈 제공
각 종류의 생성을 위한 별도의 API:
[`session.createBidirectionalStream()`][] 및
[`session.createUnidirectionalStream()`][]. 원격으로 시작된 스트림
피어는 [`session.onstream`][] 콜백을 통해 전달됩니다.

스트림에 데이터를 쓰는 두 가지 방법이 있습니다.

* **Body source** — 스트림 생성시 `body` 옵션을 통과합니다.
[`stream.setBody()`][]). 본문은 문자열, `ArrayBuffer`일 수 있습니다,
`ArrayBufferView`, `Blob`, `FileHandle`, `AsyncIterable`, 동기화 `Iterable`,
또는 `Promise`는 이러한 모든 것에 해결합니다. `null` 본문은 쓸 수 있습니다
옆 즉시. 데이터가 사용할 때 가장 간단한 접근법입니다.
미리 또는 iterable로 표현될 수 있습니다.
***Writer**- 데이터를 점진적으로를 밀어 [`stream.writer`][] 액세스. 더 보기
작가는 동시 방법을 노출 (`writeSync()`, `writevSync()`,
`endSync()`)는 즉시, 뿐 아니라 동기화 동등물
(`write()`, `writev()`, `end()`)는 역압 될 때 배수를 기다리고 있습니다.
`writeSync()`는 쓰기 버퍼가 가득 차있을 때 `false`를 반환합니다; 콜걸
retrying 전에 배수를 기다리십시오.

이 두 가지 접근법은 주어진 스트림에 대해 상호적으로 독점적입니다.

읽기는 async iterable로 스트림을 저장하여 수행됩니다. 각 반복
`Uint8Array` 펑크의 배치를 산출합니다:

```mjs
for await (const chunks of stream) {
  for (const chunk of chunks) {
    // Process each Uint8Array chunk
  }
}
```

1개의 async iterator는 시내 당 얻어질 수 있습니다. 스트림도
`node:stream/iter` 유틸리티와 호환 가능
`Stream.text()` 및 `Stream.pipeTo()`.

## 데이터그램

스트림 외에도 QUIC는 신뢰할 수없는 데이터그램 ([RFC 9221][])을 지원합니다.
사용 사례가 낮고, 최고의 메시징이 필요합니다.

Datagram 지원은 두 수준에서 활성화됩니다. QUIC 전송 수준에서, 둘 다
피어는 non-zero [`maxDatagramFrameSize`][] 전송 모수를 광고해야 합니다
핸드셰이크 중. HTTP/3 세션의 경우, 두 피어는 추가로 설정해야합니다.
[`application.enableDatagrams`][] 에 `true`, 이는 교환
`SETTINGS_H3_DATAGRAM` 설정 HTTP/3 제어 스트림.

데이터그램은 [`session.sendDatagram()`][]에 단일 통화로 전송됩니다. 각 각
datagram은 단일 QUIC 패킷 내에서 적합해야 합니다. — datagrams는 할 수 없습니다.
파열. 최대 페이로드 크기는 피어의 결정
`maxDatagramFrameSize`와 경로 MTU. datagram이 너무 크거나
피어는 데이터그램을 지원하지 않습니다, `sendDatagram()`는 `0n`를 오히려
오류 발생.

납품의 아무 보증도 없습니다. 데이터그램은 손실, 복제, 또는
주문에서 배달. [`session.ondatagramstatus`][] 콜백 보고서
각 전송된 데이터그램은 `'acknowledged'`, `'lost'` 또는 `'abandoned'`이었다는 것을 의미합니다
(철에 보내지 않는).

## 0-RTT 초기 데이터 및 세션 재개

QUIC는 이전에 연결된 클라이언트를 허용하는 0-RTT 초기 데이터를 지원합니다.
서버는 대기하지 않고 매우 첫 번째 패킷으로 애플리케이션 데이터를 전송합니다.
손으로 완성합니다. 이것은 대기 시간의 전체 왕복을 제거 할 수 있습니다
재연결.

사전 연결의 두 조각이 가능:

* [`session.onsessionticket`][] 콜백을 통해 수신 한**세션 티켓**,
TLS 세션 resumption 및 0-RTT 암호화를 활성화합니다. 패스워드
[`sessionOptions.sessionTicket`][] 옵션 후속 연결
같은 서버.
* [`session.onnewtoken`][]를 통해 받은**주소 검증 토큰**
콜백은 클라이언트가 서버의 주소 검증 단계를 건너 뛸 수 있습니다.
(Retry Round-trip). [`sessionOptions.token`][]로 전달
옵션.

서버가 세션 티켓을 수락하면, Handhake 전에 전송된 모든 데이터
완료는 0-RTT 초기 데이터입니다. 서버 측에, `stream.early`는 `true`입니다
스트림에 대한 초기 데이터. 서버는 0-RTT 시도를 거부 할 수 있습니다.
(예를 들어, 티켓이 발행 된 이후로 구성이 변경된 경우).
이 일이 일어날 때, 0-RTT 단계 동안 모든 스트림이 파괴되고있다.
클라이언트의 [`session.onearlyrejected`][] 콜백 화재. 연결하기
정상 1-RTT Handhake로 돌아와 응용 프로그램은 스트림을 다시 열 수 있습니다.

초기 데이터는 Handhake가 완료한 후 전송된 데이터보다 덜 안전합니다. — it
잠재적으로 공격자가 재생할 수 있습니다. 신청은 0-RTT를 대우해야 합니다
적절한 주의를 가진 자료 및 non-idempotent 가동을 피하십시오
초기 데이터 단계 중.

### 연결 수명주기

이 단계를 통해 전형적인 클라이언트 세션 진행:

1. 서버 주소와 선택권을 가진 [`quic.connect()`][]를 부르십시오. 이 반환
`QuicSession`.의 특징
2. TLS Handhake는 자동적으로 달립니다. `session.opened`는 때 해결합니다
Handhake는 협상 된 ALPN, cipher 및 인증서를 제공
유효성 검사
3. 스트림을 열고 datagrams를 보내고 데이터를 교환하십시오.
4. [`session.close()`][]를 호출하여 우아한 폐쇄를 시작합니다. Existing 흐름
종료 할 수 있습니다, 그 세션은 파괴된다. 반환 약속
(또한 `session.closed`로 사용할 수 있습니다) 눈물이 완료되면 해결합니다.

서버 측에서 호출 [`quic.listen()`][] 콜백. 콜백
TLS Handhake가 시작됩니다. 내 계정
스트림은 [`session.onstream`][] 콜백을 통해 도착합니다.

[`session.destroy()`][]는 즉시 찢어짐을 위해 유효합니다 — 모든 열려있는 시내
파괴하고 세션은 종료하지 않고 닫힙니다.

`QuicEndpoint` 및 `QuicSession` 지원 `Symbol.asyncDispose`, 그래서 그들은 할 수 있습니다
자동 세척을 위한 `await using`로 사용될 것입니다.

### 오류 처리

`quic` 모듈의 오류는 두 가지 보완을 통해 통신
메커니즘 : `onerror` 콜백 및 `closed` 약속.

`QuicSession`와 `QuicStream` 모두 옵션 `onerror` 콜백을 노출합니다.
세션 또는 스트림이 오류로 파괴 될 때 - 오류를 포함
다른 사용자 콜백에 의해 - `onerror` 콜백은 오류가 발생
객체가 찢어지기 전에. `onerror` 설정 또한 `closed`를 표시
처리로 약속, unhandled 거부 경고를 방지. `onerror`의 경우
설정되지 않습니다, 오류가 단독으로 전달됩니다.
`closed` 약속.

[`QuicError`][] 클래스는 명시된 숫자 QUIC 오류 코드를 나릅니다.
([`error.errorCode`][]) 보통 `message` 및 `code` 속성과 함께.
`QuicError`가 [`stream.destroy()`][]로 전달될 때
[`writer.fail()`][], `errorCode`는 `RESET_STREAM` 또는
`STOP_SENDING` 프레임은 피어로 전송됩니다. 다른 오류 유형은 다시 돌아갑니다.
협상 된 프로토콜의 일반적인 내부 오류 코드.

### 권한 모델

[Permission Model][]를 사용할 때 `--allow-net` 플래그가 전달되어야 합니다.
QUIC 네트워크 운영을 허용한다. 그것 없이, [`quic.connect()`][]를 부르거나
[`quic.listen()`][]는 `ERR_ACCESS_DENIED` 오류를 발생시킵니다.

```console
$ node --permission --allow-fs-read=* --experimental-quic index.mjs
Error: Access to this API has been restricted. Use --allow-net to manage permissions.
  code: 'ERR_ACCESS_DENIED',
  permission: 'Net',
}
```

연결하거나 듣지 않고 [`QuicEndpoint`][] 인스턴스 만들기
`--allow-net` 없이도 허용됩니다.
[`quic.connect()`][] 또는 [`quic.listen()`][] 라고 합니다.

## `quic.connect(address[, options])`

<!-- YAML
added: v23.8.0
-->

* `address` {string|net.SocketAddress}
* `options` {quic.SessionOptions}
* Returns: {Promise} a promise for a {quic.QuicSession}

새로운 클라이언트 측 세션 시작.

```mjs
import { connect } from 'node:quic';
import { Buffer } from 'node:buffer';

const enc = new TextEncoder();
const alpn = 'foo';
const client = await connect('123.123.123.123:8888', { alpn });
await client.createUnidirectionalStream({
  body: enc.encode('hello world'),
});
```

기본적으로, `connect(...)`에 모든 호출은 새로운 로컬를 만들 것입니다
`QuicEndpoint` 인스턴스는 새로운 임의 로컬 IP 포트에 바인딩합니다. 으로
사용하기 위해 정확한 로컬 주소를 지정하거나 여러 번에 여러 번 설정
단일 로컬 포트에 QUIC 세션, `endpoint` 옵션을 통과
`QuicEndpoint` 또는 `EndpointOptions`를 인수로 합니다.

```mjs
import { QuicEndpoint, connect } from 'node:quic';

const endpoint = new QuicEndpoint({
  address: '127.0.0.1:1234',
});

const client = await connect('123.123.123.123:8888', { endpoint });
```

## `quic.listen(onsession[, options])`

<!-- YAML
added: v23.8.0
-->

* `onsession` {quic.OnSessionCallback}
* `options` {quic.SessionOptions}
* Returns: {Promise} a promise for a {quic.QuicEndpoint}

서버로 듣는 endpoint 구성 새로운 세션이 시작될 때
리모컨, 주어진 `onsession` 콜백은 생성된 것과 함께 호출될 것입니다
세션.

```mjs
import { listen } from 'node:quic';

const endpoint = await listen((session) => {
  // ... handle the session
});

// Closing the endpoint allows any sessions open when close is called
// to complete naturally while preventing new sessions from being
// initiated. Once all existing sessions have finished, the endpoint
// will be destroyed. The call returns a promise that is resolved once
// the endpoint is destroyed.
await endpoint.close();
```

기본적으로, `listen(...)`에 모든 호출은 새로운 로컬를 만들 것입니다
`QuicEndpoint` 인스턴스는 새로운 임의 로컬 IP 포트에 바인딩합니다. 으로
사용하기 위해 정확한 로컬 주소를 지정하거나 여러 번에 여러 번 설정
단일 로컬 포트에 QUIC 세션, `endpoint` 옵션을 통과
`QuicEndpoint` 또는 `EndpointOptions`를 인수로 합니다.

대부분의 단일 `QuicEndpoint`는 듣기만 할 수 있습니다.
한 번 서버.

## `quic.listEndpoints([options])`

<!-- YAML
added: v26.4.0
-->

* `options` {object}
* Returns: {quic.QuicEndpoint\[]}
능동태 ( 파괴되지 않음, 폐쇄하지 않고, 바쁜). `false`가 모든 것을 반환하는 경우
끝점.
* Returns: {quic.QuicEndpoint\[]}

모든 `QuicEndpoint` 인스턴스 목록을 반환합니다. 기본적으로만 활성화
endpoints는 반환됩니다.

## `quic.constants`

<!-- YAML
added: v26.2.0
-->

* 이름

QUIC 구성을 위한 통용되는 상수도가 포함된 객체.

#### `quic.constants.cc`

* 이름

Congestion 제어 알고리즘 식별자, 사용
[`sessionOptions.cc`][] 옵션:

* `quic.constants.cc.RENO` - 혼잡 제어.
* `quic.constants.cc.CUBIC` - CUBIC 혼잡 통제.
* `quic.constants.cc.BBR` - BBR 혼잡 제어.

#### `quic.constants.DEFAULT_CIPHERS`

* 이름

[`sessionOptions.ciphers`][]가 사용되는 기본 TLS 1.3 cipher 스위트 목록
지정되지 않습니다.

#### `quic.constants.DEFAULT_GROUPS`

* 이름

기본 TLS 1.3 키 교환 그룹 목록이 사용될 때
[`sessionOptions.groups`][]는 지정되지 않습니다.

## 종류: `QuicEndpoint`

`QuicEndpoint`는 QUIC에 대한 로컬 UDP 포트 바인딩을 캡슐화합니다. 그것은 일 수 있습니다
클라이언트와 서버 모두 사용.

#### `new QuicEndpoint([options])`

<!-- YAML
added: v23.8.0
-->

* `options` {quic.EndpointOptions}

#### `endpoint.address`

<!-- YAML
added: v23.8.0
-->

* Type: {net.SocketAddress|undefined}

로컬 UDP 소켓 주소는 끝점이 바인딩되어 있다면.

endpoint가 현재 바인딩되지 않은 경우 값은 `undefined`입니다. 읽기 전용입니다

#### `endpoint.busy`

<!-- YAML
added: v23.8.0
-->

* Type: {boolean}

`endpoint.busy`가 true로 설정되면 엔드포인트가 일시적으로 거부됩니다.
만든 새로운 세션. 읽기/쓰기.

```mjs
// Mark the endpoint busy. New sessions will be prevented.
endpoint.busy = true;

// Mark the endpoint free. New session will be allowed.
endpoint.busy = false;
```

`busy` 속성은 단점이 무거운 짐의 밑에 있을 때 유용합니다
일시적으로 새로운 세션을 거부하고 있습니다.

#### `endpoint.close()`

<!-- YAML
added: v23.8.0
-->

* Returns: {Promise}

아름다운 끝점. 끝점은 닫히고 스스로를 파괴합니다.
현재 세션이 종료됩니다. 호출되면 새로운 세션이 거부됩니다.

끝점이 파괴될 때의 약속을 반환합니다.

#### `endpoint.closed`

<!-- YAML
added: v23.8.0
-->

* Type: {Promise}

끝점이 파괴될 때의 약속. 이것은 같은 약속이 될 것입니다.
`endpoint.close()` 기능에 의해 반환. 읽기 전용입니다

#### `endpoint.closing`

<!-- YAML
added: v23.8.0
-->

* Type: {boolean}

`endpoint.close()`가 아직 완료되지 않은 경우 True.
읽기 전용입니다

#### `endpoint.destroy([error])`

<!-- YAML
added: v23.8.0
-->

* `error` {any}

모든 개방 세션을 즉시 강제로 종료
자주 묻는 질문

#### `endpoint.destroyed`

<!-- YAML
added: v23.8.0
-->

* Type: {boolean}

`endpoint.destroy()`가 호출 된 경우 true. 읽기 전용입니다

#### `endpoint.listening`

<!-- YAML
added: v26.2.0
-->

* Type: {boolean}

endpoint가 적극적으로 들어오는 연결을 듣는 경우 true. 읽기 만.

#### `endpoint.maxConnectionsPerHost`

<!-- YAML
added: v26.2.0
-->

* Type: {number}

원격 IP 주소 당 허용되는 동시 연결 수.
`0`는 무제한 (과태)를 의미합니다. 건설 시간에 설정할 수 있습니다
`maxConnectionsPerHost` 옵션과 동시에 동적 변경.
유효한 범위는 `0`에 `65535`입니다.

#### `endpoint.maxConnectionsTotal`

<!-- YAML
added: v26.2.0
-->

* Type: {number}

모든 리모트를 통하여 동시 연결의 최대 총 수
주소. `0`는 무제한 (기본)를 의미합니다. 건축 시간에 설치될 수 있습니다
`maxConnectionsTotal` 옵션과 동시에 동적 변경.
유효한 범위는 `0`에 `65535`입니다.

#### `endpoint.setSNIContexts(entries[, options])`

<!-- YAML
added:
 - v26.1.0
 - v24.16.0
-->

* `entries` {object} An object mapping host names to TLS identity options.
각 항목은 `keys` 및 `certs`를 포함해야합니다.
* `options` {object}
* `replace` {불린} `true`가 전체 SNI 맵을 대체하면 됩니다. `false`의 경우
(기본값), 기존 맵으로 항목을 병합합니다.

이 엔드포인트의 SNI TLS 컨텍스트를 대체하거나 업데이트합니다. 이 허용
특정 호스트 이름에 사용되는 TLS ID (key/certificate) 변경
endpoint를 재시작하지 않고. Existing sessions are unaffected — 단지
새로운 세션은 업데이트 된 컨텍스트를 사용합니다.

```mjs
endpoint.setSNIContexts({
  'api.example.com': { keys: [newApiKey], certs: [newApiCert] },
});

// Replace the entire SNI map
endpoint.setSNIContexts({
  'api.example.com': { keys: [newApiKey], certs: [newApiCert] },
}, { replace: true });
```

#### `endpoint.stats`

<!-- YAML
added: v23.8.0
-->

* Type: {quic.QuicEndpoint.Stats}

Active endpoint에 수집된 통계. 읽기 만.

#### `endpoint[Symbol.asyncDispose]()`

<!-- YAML
added: v23.8.0
-->

`endpoint.close()`를 호출하고 언제 성취하는 약속을 반환합니다.
끝점은 닫힙니다.

## 종류: `QuicEndpoint.Stats`

<!-- YAML
added: v23.8.0
-->

endpoint에 대한 수집 된 통계의보기.

#### `endpointStats.createdAt`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint} A timestamp indicating the moment the endpoint was created. Read only.

#### `endpointStats.destroyedAt`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint} A timestamp indicating the moment the endpoint was destroyed. Read only.

#### `endpointStats.bytesReceived`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint} The total number of bytes received by this endpoint. Read only.

#### `endpointStats.bytesSent`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint} The total number of bytes sent by this endpoint. Read only.

#### `endpointStats.packetsReceived`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint} The total number of QUIC packets successfully received by this endpoint. Read only.

#### `endpointStats.packetsSent`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint} The total number of QUIC packets successfully sent by this endpoint. Read only.

#### `endpointStats.serverSessions`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint} The total number of peer-initiated sessions received by this endpoint. Read only.

#### `endpointStats.clientSessions`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint} The total number of sessions initiated by this endpoint. Read only.

#### `endpointStats.serverBusyCount`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint} The total number of times an initial packet was rejected due to the
표시된 바우처 읽기 전용입니다

#### `endpointStats.retryCount`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint} The total number of retry packets sent by this endpoint. Read only.

#### `endpointStats.retryRateLimited`

* Type: {bigint} The total number of retry packets dropped by the global rate
제한 사항 읽기 전용입니다 non-zero 값은 endpoint가 retry의 밑에 있다는 것을 나타냅니다
홍수 압력.

#### `endpointStats.versionNegotiationCount`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint} The total number of version negotiation packets sent by this
끝점. 읽기 전용입니다

#### `endpointStats.versionNegotiationRateLimited`

* Type: {bigint} The total number of version negotiation packets dropped by
글로벌 비율 제한자. 읽기 전용입니다

#### `endpointStats.statelessResetCount`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint} The total number of stateless reset packets sent by this
끝점. 읽기 전용입니다

#### `endpointStats.statelessResetRateLimited`

* Type: {bigint} The total number of stateless reset packets dropped by the
글로벌 속도 제한기. 읽기 전용입니다

#### `endpointStats.immediateCloseCount`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint} The total number of immediate connection close packets sent
이 endpoint에 의해. 읽기 전용입니다

#### `endpointStats.immediateCloseRateLimited`

* Type: {bigint} The total number of immediate connection close packets
Global Rate limiter에 의해 떨어졌다. 읽기 만.

#### `endpointStats.sessionCreationRateLimited`

* Type: {bigint} The total number of session creation attempts dropped by the
per-host 비율 제한기. 읽기 전용입니다 비-제로 값은 하나 이상의 것을 나타냅니다.
원격 주소는 구성 비율보다 더 빠른 세션을 만들 수 있습니다.

#### `endpointStats.packetsBlocked`

* Type: {bigint} The total number of incoming packets dropped by the
블록 목록 필터. 읽기 전용입니다

## 종류: `QuicSession`

<!-- YAML
added: v23.8.0
-->

`QuicSession`는 QUIC 연결의 지역 측면을 나타냅니다.

#### `session.applicationOptions`

<!-- YAML
added: v26.3.0
-->

* Type: {quic.ApplicationOptions}

이 세션의 현재 애플리케이션 레벨 옵션. 이 설정 포함
협상 된 애플리케이션 프로토콜 (예 : HTTP/3)과 특정 할 수 있음
전송 모수에서 별도로 협상될 것입니다. 읽기 만.
콜백 [`session.onapplication`][]를 사용하여 설정을 알 수 있습니다.
먼 도착에서.

#### `session.close([options])`

<!-- YAML
added: v23.8.0
-->

* `options` {Object}
* Returns: {Promise}
프레임은 피어로 전송됩니다.**기본값:**`0` (오류 없음).
* `type` {string} `'transport'` 또는 `'application'`.의 경우 자주 묻는 질문
`CONNECTION_CLOSE` 프레임에 사용되는 오류 코드 네임스페이스. 언제 `'transport'`
(기본값), 프레임 타입은 `0x1c`이며 코드는 QUIC로 해석됩니다.
전송 오류. `'application'`의 프레임 타입은 `0x1d`와 코드입니다.
신청 별입니다.**기본값:**`'transport'`.
* `reason` {string} 선택적 인 읽을 수없는 이유 문자열에 포함
`CONNECTION_CLOSE` 프레임. RFC 9000 당, 이것은 진단 목적을 위해 입니다
단지 기계 읽기 쉬운 오류 설명에 사용할 수 없습니다.
* Returns: {제공}

세션의 우아한 마감을 시작하십시오. 기존 스트림은 허용됩니다
완료하지만 새로운 스트림이 열리지 않습니다. 모든 스트림이 닫히면
세션이 파괴됩니다. 반환 약속은 한 번 성취됩니다.
세션이 파괴되었습니다. 비제로 `code`가 지정되면
약속은 `ERR_QUIC_TRANSPORT_ERROR` 또는
`ERR_QUIC_APPLICATION_ERROR`에 따라 `type`.

#### `session.opened`

<!-- YAML
added: v26.2.0
-->

* Type: {Promise} for an {Object}
* `local` {net.SocketAddress} 로컬 소켓 주소.
* `remote` {net.SocketAddress} 원격 소켓 주소.
* `servername` {string} SNI 서버 이름은 Handhake 도중 협상했습니다.
* `protocol` {string} Handhake에서 협상 된 ALPN 프로토콜.
* `cipher` {string} 협상 된 TLS cipher 스위트의 이름.
* `cipherVersion` {string} cipher Suite의 TLS 프로토콜 버전
(예: `'TLSv1.3'`).
* `validationErrorReason` {string} 인증이 실패한 경우,
이유 문자열. 유효성 검사가 성공하면 빈 문자열.
* `validationErrorCode` {number} 인증이 실패한 경우,
오류 코드. 유효한 경우에 `0`.
* `earlyDataAttempted` {불린} 0-RTT 초기 데이터가 시도되었는지 여부.
* `earlyDataAccepted` {불린} 0-RTT 초기 데이터가 허용되지 않음
서버.

TLS Handhake가 성공적으로 완료된 것을 약속합니다.
해결된 값은 설치된 세션에 대한 정보를 포함합니다.
협상된 프로토콜을 포함하여, cipher suite, 인증서 검증
상태 및 0-RTT 초기 데이터 상태.

핸드셰이크가 실패하거나 세션이 핸드셰이크 앞에 파괴되면
완료, 약속은 거부됩니다.

#### `session.closed`

<!-- YAML
added: v23.8.0
-->

* Type: {Promise}

세션이 파괴되면 성취되는 약속.

#### `session.closing`

<!-- YAML
added: v26.2.0
-->

* Type: {boolean}

[`session.close()`][]가 호출되고 세션이 아직 없습니다.
충분합니다. 읽기 전용입니다

#### `session.destroy([error[, options]])`

<!-- YAML
added: v23.8.0
-->

* `error` {any}
* `options` {Object}
* `code` {bigint|number} `CONNECTION_CLOSE`에 포함된 오류 코드
프레임은 피어로 전송됩니다.**기본값:**`0`.
* `type` {string} `'transport'` 또는 `'application'`.**Default:**
`'transport'`.
* `reason` {string} 선택적 인 읽을 수없는 이유 문자열에 포함
`CONNECTION_CLOSE` 프레임.

즉시 세션을 파괴합니다. 모든 스트림은 파괴되고
세션이 종료됩니다. `error`가 제공되고 [`session.onerror`][]는
설정, `onerror` 콜백은 파괴하기 전에 호출됩니다. 더 보기
`session.closed` 약속은 오류로 거부됩니다. `options`가 있다면
제공된 `CONNECTION_CLOSE` 프레임은 피어에 전송됩니다
지정된 오류 코드, 유형 및 이유.

#### `session.destroyed`

<!-- YAML
added: v23.8.0
-->

* Type: {boolean}

`session.destroy()`가 호출 된 경우 true. 읽기 전용입니다

#### `session.localTransportParams`

<!-- YAML
added: v26.3.0
-->

* Type: {quic.TransportParams|null}

핸드셰이크 도중 국부적으로 endpoint에 의해 광고되는 전송 모수.
세션이 파괴 된 경우 `null`를 반환합니다. 읽기 전용입니다

#### `session.endpoint`

<!-- YAML
added: v23.8.0
-->

* Type: {quic.QuicEndpoint|null}

이 세션을 만들었습니다. 세션이면 `null`를 반환합니다.
파괴되었습니다. 읽기 전용입니다

#### `session.onapplication`

<!-- YAML
added: v26.4.0
-->

* Type: {quic.OnApplicationCallback}

새로운 애플리케이션 옵션이 있을 때 호출백, 예를 들어 HTTP/3 설정이 도착했습니다.

#### `session.onerror`

<!-- YAML
added: v26.2.0
-->

* Type: {Function|undefined}

세션이 오류로 파괴 될 때 옵션 콜백.
이것은 사용자 콜백에 의한 오류가 발생하거나 거부 (see)
[Callback error handling][]). 콜백은 단일 인수를받습니다.
파괴를 유발하는 오류. `onerror` 콜백 자체가 던지면
또는 거부하는 약속을 반환, 오류는 uncaught로 표면
예외. 읽기/쓰기.

또한 `onerror` 옵션을 통해 설정할 수 있습니다.
[`quic.listen()`][].

#### `session.onstream`

<!-- YAML
added: v23.8.0
-->

* Type: {quic.OnStreamCallback}

새로운 스트림이 원격 피어에 의해 시작될 때 콜백. 읽기/쓰기.

#### `session.ondatagram`

<!-- YAML
added: v23.8.0
-->

* Type: {quic.OnDatagramCallback}

새 데이터그램이 원격 피어에서 수신될 때 콜백. 읽기/쓰기.

#### `session.ondatagramstatus`

<!-- YAML
added: v23.8.0
-->

* Type: {quic.OnDatagramStatusCallback}

datagram의 상태가 업데이트되면 콜백. 읽기/쓰기.

#### `session.onearlyrejected`

<!-- YAML
added: v26.2.0
-->

* Type: {Function|undefined}

서버가 0-RTT 초기 데이터를 거부할 때 콜백. 시간 :
이 불, 0-RTT 단계 동안 열었던 모든 스트림은
충분합니다. 이 응용 프로그램은 필요한 경우 다시 오픈 스트림을해야합니다.
읽기/쓰기.

이 콜백은 서버가 거부 할 때 클라이언트 측에서만 화재를 발생시킵니다.
클라이언트의 0-RTT 시도. 연결은 1-RTT로 돌아가고
계속.

#### `session.onpathvalidation`

<!-- YAML
added: v23.8.0
-->

* Type: {quic.OnPathValidationCallback}

경로 검증이 업데이트될 때 콜백. 읽기 / 쓰기.

#### `session.onsessionticket`

<!-- YAML
added: v23.8.0
-->

* Type: {quic.OnSessionTicketCallback}

새 세션 티켓이 수신될 때 콜백. 읽기 / 쓰기.

#### `session.onversionnegotiation`

<!-- YAML
added: v23.8.0
-->

* Type: {quic.OnVersionNegotiationCallback}

버전 협상이 시작될 때 콜백. 읽기/쓰기.

#### `session.onhandshake`

<!-- YAML
added: v23.8.0
-->

* Type: {quic.OnHandshakeCallback}

TLS Handhake가 완료되면 호출합니다. 읽기/쓰기.

#### `session.onnewtoken`

<!-- YAML
added: v26.2.0
-->

* Type: {quic.OnNewTokenCallback}

New\ TOKEN 토큰이 서버에서 수신될 때 호출됩니다.
토큰은 향후 연결에 `token` 옵션으로 전달될 수 있습니다.
동일한 서버는 주소 검증을 건너뛰기. 읽기 / 쓰기.

#### `session.onorigin`

<!-- YAML
added: v26.2.0
-->

* Type: {quic.OnOriginCallback}

ORIGIN 프레임 (RFC 9412)가 수신 될 때 호출
서버는 서버가 권한이 있는 것을 나타냅니다.
읽기/쓰기.

#### `session.ongoaway`

<!-- YAML
added: v26.2.0
-->

* Type: {Function}

피어가 HTTP/3 GOAWAY 프레임을 보낼 때 호출 백,
그것은 우아한 폐쇄를 시작. 콜백 수신
`(lastStreamId)`는 `lastStreamId`는 `{bigint}`입니다.

* `lastStreamId`가 `-1n`일 때, 피어는 폐쇄 통지를 보냈습니다 (intent)
스트림 경계를 지정하지 않고). 모든 기존 스트림
여전히 처리 될 수 있습니다.
* `lastStreamId`가 `>= 0n`일 때 가장 높은 스트림 ID는 피어
처리 할 수 있습니다. 이 값 위에 ID와 스트림이 되지 않았습니다.
가공하고 안전하게 새로운 연결에 의지할 수 있습니다.

GOAWAY가 수신되면 `session.createBidirectionalStream()`가됩니다.
`ERR_INVALID_STATE`를 던졌습니다. 기존 스트림은 계속 될 때까지
완료 또는 세션 닫기.

이 콜백은 HTTP/3 세션에만 해당됩니다. 읽기 / 쓰기.

#### `session.onkeylog`

<!-- YAML
added: v26.2.0
-->

* Type: {quic.OnKeylogCallback}

TLS 키 소재가 사용할 때 호출백. 
[`sessionOptions.keylog`][]는 `true`입니다. 각 직업은 단 하나받습니다
[NSS Key Log Format][] 텍스트의 라인 (새로운 라인 포함). 이것은
Wireshark와 같은 도구를 사용하여 패킷 캡처를 해독하는 데 유용합니다. 읽기 / 쓰기.

또한 `onkeylog` 옵션을 통해 설정할 수 있습니다.
[`quic.listen()`][].

#### `session.onqlog`

<!-- YAML
added: v26.2.0
-->

* Type: {quic.OnQlogCallback}

qlog 데이터가 사용할 때 invoke에 콜백. 
[`sessionOptions.qlog`][]는 `true`입니다. 콜백은 문자열을받습니다.
[JSON-SEQ][] 포맷 된 qlog 데이터와 boolean `fin` 플래그의 펑크. 시간 :
`fin`는 `true`이며, 펑크는 이 세션의 최종 qlog 출력이며,
concatenated 펑크는 완전한 qlog 추적을 형성합니다. 읽기 / 쓰기.

Qlog 데이터는 연결 수명주기 동안 도착합니다. 첫번째 펑크는 포함합니다
형식 metadata를 가진 qlog 헤더. 순차적 펑크는 추적을 포함합니다
이벤트. 최종 펑크 (`fin`가 `true`로 설정됨)
세션 파괴 및 JSON-SEQ 출력을 완료합니다.

또한 `onqlog` 옵션을 통해 설정할 수 있습니다.
[`quic.listen()`][].

#### `session.createBidirectionalStream([options])`

<!-- YAML
added: v23.8.0
-->

* `options` {Object}
* Returns: {Promise} for a {quic.QuicStream}
Blob | FileHandle | AsyncIterable | Iterable | Promise | null}
Outbound 몸 근원. 자세한 내용은 [`stream.setBody()`][] 참조
지원되는 유형. omitted 때, 스트림의 나가는 측은 남아 있습니다
본문이 채우지 않는 writable; FIN는 즉각 보내지 않습니다.
* `headers` {Object} 초기 요청 또는 응답 헤더를 보낼 수 있습니다.
세션이 헤더(e.g. HTTP/3)를 지원할 때 사용됩니다. `body`가 아닌 경우
지정되고 `headers`는, 시내가 대우됩니다
헤더 전용 (terminal).
* `priority` {string} 스트림의 우선 순위. `'high'`의 하나,
`'default'`, 또는 `'low'`.**기본값:**`'default'`.
* `incremental` {불린} `true`이 스트림의 데이터가 있을 때
같은 우선 순위의 다른 스트림에서 데이터로 interleaved.
`false`가 있을 때, 스트림은 동일 선명한 피어 이전에 완료되어야 합니다.
**기본값:**`false`.
* `highWaterMark` {number} 작가의 최대 바이트 수
`writeSync()`의 앞에 완충기는 `false`를 반환합니다. 버퍼링 할 때
데이터는이 제한을 초과, 콜러는 전에 하수구를 기다립니다
더 읽기.**기본값:**`65536` (64 KB).
* `onheaders`  수신 초기 응답 헤더에 대한 콜백.
`(headers)`로 전화.
* `ontrailers`  수신된 추적 헤더에 대한 콜백.
`(trailers)`로 전화.
* `oninfo` {Function} 수신된 정보 (1xx) 헤더에 대한 콜백.
`(headers)`로 전화.
* `onwanttrailers`  트레일러가 전송 될 때 콜백.
인수가 없습니다. [`stream.sendTrailers()`][]를 사용하십시오.
콜백.
* Returns: {Promise} for a {quic.QuicStream}

새로운 양방향 스트림을 엽니다. `body` 옵션이 지정되지 않은 경우,
스트림의 나가는 측은 writable 남아 있고 FIN는 보내집니다
즉시. `priority` 및 `incremental`
세션이 우선(e.g. HTTP/3)을 지원할 때만 사용할 수 있습니다.
`headers`, `onheaders`, `ontrailers`, `oninfo`, `onwanttrailers`
세션이 헤더(e.g. HTTP/3)를 지원할 때만 사용할 수 있습니다.

#### `session.createUnidirectionalStream([options])`

<!-- YAML
added: v23.8.0
-->

* `options` {Object}
* Returns: {Promise} for a {quic.QuicStream}
Blob | FileHandle | AsyncIterable | Iterable | Promise | null}
Outbound 몸 근원. 자세한 내용은 [`stream.setBody()`][] 참조
지원되는 유형. omitted 때, 스트림의 나가는 측은 남아 있습니다
본문이 채우지 않는 writable; FIN는 즉각 보내지 않습니다.
* `headers` {Object} 초기 요청 헤더를 보낼 수 있습니다.
* `priority` {string} 스트림의 우선 순위. `'high'`의 하나,
`'default'`, 또는 `'low'`.**기본값:**`'default'`.
* `incremental` {불린} `true`이 스트림의 데이터가 있을 때
같은 우선 순위의 다른 스트림에서 데이터로 interleaved.
`false`가 있을 때, 스트림은 동일 선명한 피어 이전에 완료되어야 합니다.
**기본값:**`false`.
* `highWaterMark` {number} 작가의 최대 바이트 수
`writeSync()`의 앞에 완충기는 `false`를 반환합니다. 버퍼링 할 때
데이터는이 제한을 초과, 콜러는 전에 하수구를 기다립니다
더 읽기.**기본값:**`65536` (64 KB).
* `onheaders`  수신 초기 응답 헤더에 대한 콜백.
`(headers)`로 전화.
* `ontrailers`  수신된 추적 헤더에 대한 콜백.
`(trailers)`로 전화.
* `oninfo` {Function} 수신된 정보 (1xx) 헤더에 대한 콜백.
`(headers)`로 전화.
* `onwanttrailers`  트레일러가 전송 될 때 콜백.
* Returns: {Promise} for a {quic.QuicStream}

새로운 단방향 스트림을 엽니다. `body` 옵션이 지정되지 않은 경우,
스트림의 나가는 측은 writable 남아 있고 FIN는 보내집니다
즉시. `priority` 및 `incremental`
세션이 우선(e.g. HTTP/3)을 지원할 때만 사용할 수 있습니다.

#### `session.path`

<!-- YAML
added: v23.8.0
-->

* Type: {Object|undefined}
* `local` {net.SocketAddress}
* `remote` {net.SocketAddress}

세션과 관련된 로컬 및 원격 소켓 주소. 읽기 만.

#### `session.remoteTransportParams`

<!-- YAML
added: v26.3.0
-->

* Type: {quic.TransportParams|null|undefined}

핸드셰이크 도중 원격 피어에 의해 광고되는 전송 모수.
세션이 파괴되면 `null`를 반환합니다.
아직 완료되지 않고 원격 매개 변수는 아직 사용할 수 없습니다. ...에서


#### `session.sendDatagram(datagram[, encoding])`

<!-- YAML
added: v23.8.0
-->

* `datagram` {string|ArrayBufferView|Promise}
* `encoding` {string} The encoding to use if `datagram` is a string.
**기본값:**`'utf8'`.
* Returns: {Promise} for a {bigint} datagram ID.

원격 피어에 신뢰할 수없는 데이터그램을 전송, 약속을 반환
데이터그램 ID.

`datagram`가 문자열이라면 지정된 `encoding`를 사용하여 인코딩됩니다.

`datagram`가 `ArrayBufferView`인 경우 바이트가 복사됩니다.
내부 버퍼; 콜러 소스 버퍼는 변하지 않고 재사용 될 수있다
또는 호출 반환 후 즉시 mutated. 확인을 원하는 통화
그 소스는 호출 후 mutated 할 수 없습니다 (예를 들어, 손으로 할 때
다른 async 소비자에 버퍼) 호출할 수 있습니다
`ArrayBuffer.prototype.transfer()` 버퍼를 통과하기 전에 스스로.

`datagram`가 `Promise`인 경우 전송하기 전에 기다리겠습니다. 만약에
세션은 대기 중이며 `0n`는 침묵으로 반환됩니다 (datagrams는
믿을 수 없는).

datagram 페이로드가 0 길이 인 경우 (코딩 후 구문 문자열, detached
완충기, 또는 영 길이 전망), `0n`는 돌려보내고 datagram가 보내지 않습니다.

HTTP/3 세션의 경우 피어는 `SETTINGS_H3_DATAGRAM=1`를 광고해야합니다.
(`application: { enableDatagrams: true }`를 통해)
피어의 설정이 `0` 인 경우 `sendDatagram()`는 `0n` (RFC 9297 당)를 반환합니다.
§3, 엔드포인트 MUST는 피어가 표시된 경우 HTTP Datagrams를 보내지 않습니다.
지원).

Datagrams는 파편이 될 수 없습니다 — 각각은 단일 QUIC 패킷 안에 적합해야 합니다.
최대 데이터그램 크기는 피어의 크기에 따라 결정됩니다.
`maxDatagramFrameSize` 전송 모수 ( 피어가 도중 광고하는)
핸드셰이크 피어가 `0`로 설정하면 데이터그램이 지원되지 않습니다.
`0n`는 반환됩니다. 데이터그램이 피어의 한계를 초과하면
`0n`가 리턴됩니다.
`maxDatagramFrameSize` 전송 모수 (과태: `1200` 바이트) 통제
이 엔드포인트는 피어에게 자신의 최대로 광고합니다.

#### `session.certificate`

<!-- YAML
added: v26.2.0
-->

* Type: {crypto.X509Certificate|undefined}

[`crypto.X509Certificate`][] 인스턴스로 로컬 인증서. 계정 관리
세션은 협상 된 SNI 호스트를 위해 구성된 인증서를 반환합니다.
클라이언트 세션은 클라이언트 인증서가 전송되지 않는 `undefined`를 반환합니다.
세션이 파괴되면 `undefined`를 반환합니다.

#### `session.peerCertificate`

<!-- YAML
added: v26.2.0
-->

* Type: {crypto.X509Certificate|undefined}

[`crypto.X509Certificate`][] 인스턴스로 피어의 인증서. 기타 제품
`undefined`는 인증서를 제시하지 않았거나 세션은
파괴.

#### `session.ephemeralKeyInfo`

<!-- YAML
added: v26.2.0
-->

* Type: {Object|undefined}

세션의 ephemeral 키 정보, 속성과 같은 속성
`type`, `name` 및 `size`. 클라이언트 세션에서만 사용할 수 있습니다. 기타 제품
`undefined` 서버 세션 또는 세션이 파괴되면.

#### `session.maxDatagramSize`

<!-- YAML
added: v26.2.0
-->

* Type: {number}

최대 datagram payload 크기가 바이트에서 피어가 허용됩니다.
이것은 피어의 `maxDatagramFrameSize` 전송에서 파생됩니다
매개변수 minus DATAGRAM 구조 머리 위 (유형 바이트 및 가변 길이
integer 인코딩) `0`를 반환하면 데이터그램이나
아직 완료되지 않은 경우. 이 값보다 큰 Datagrams
전송되지 않습니다.

#### `session.maxPendingDatagrams`

<!-- YAML
added: v26.2.0
-->

* Type: {number}
***기본:**`128`

전송할 수 있는 datagrams의 최대 수. 데이터그램
`sendDatagram()`가 호출되고 opportunistically 전송 될 때 누락됩니다
패킷 직렬화 루프에 의한 스트림 데이터. 자주 묻는 질문
[`sessionOptions.datagramDropPolicy`][]는 충분히 결정합니다
가장 오래된 데이터그램은 떨어졌습니다. Dropped datagrams는 보고됩니다
`ondatagramstatus` 콜백을 통해 손실.

이 재산은 queue 수용량을 조정하기 위하여 동적인 변화될 수 있습니다
적용 활동 또는 기억 압력에 기초를 두어. 유효한 범위
`0`로 `65535`입니다.

#### `session.stats`

<!-- YAML
added: v23.8.0
-->

* Type: {quic.QuicSession.Stats}

세션의 현재 통계를 반환합니다. 읽기 만.

#### `session.updateKey()`

<!-- YAML
added: v23.8.0
-->

세션의 키 업데이트 시작.

#### `session[Symbol.asyncDispose]()`

<!-- YAML
added: v23.8.0
-->

`session.close()`를 호출하고 언제 성취하는 약속을 반환합니다.
세션이 종료되었습니다.

## 종류: `QuicSession.Stats`

<!-- YAML
added: v23.8.0
-->

#### `sessionStats.createdAt`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.closingAt`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.handshakeCompletedAt`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.handshakeConfirmedAt`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.bytesReceived`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.bytesSent`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.bidiInStreamCount`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.bidiOutStreamCount`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.uniInStreamCount`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.uniOutStreamCount`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.maxBytesInFlight`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.bytesInFlight`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.blockCount`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.cwnd`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.latestRtt`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.minRtt`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.rttVar`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.smoothedRtt`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.ssthresh`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.datagramsReceived`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.datagramsSent`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.datagramsAcknowledged`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.datagramsLost`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `sessionStats.streamsIdleTimedOut`

* Type: {bigint} The total number of peer-initiated streams destroyed by the
스트림 idle timeout. 읽기 전용입니다

## 종류: `QuicError`

<!-- YAML
added: v26.2.0
-->

> 안정성: 1 - 실험

`QuicError`는 `Error` 서브클래스입니다.
QUIC 오류 코드. QUIC 스트림 또는 세션을 할당
특정한 application-protocol-defined 오류 코드는 대신 letting
구현은 일반적인 fallback을 선택합니다.

종류는 `node:quic`에서 수출됩니다:

```mjs
import { QuicError } from 'node:quic';
```

```cjs
const { QuicError } = require('node:quic');
```

`QuicError`가 와이어 프레임을 방출하는 API에 공급될 때
([`writer.fail()`][], [`stream.destroy()`][]), QUIC 스택 사용
결과를 위한 철사 부호로 [`error.errorCode`][].
다른 값이 공급될 때 (예를 들면 일반 `Error`),
구현은 협상 된 애플리케이션 프로토콜의 뒤로 떨어졌다
"내부 오류"코드 (`H3_INTERNAL_ERROR` (`0x102`) HTTP/3, 또는
QUIC 전송 층 `INTERNAL_ERROR` (`0x1`) 원료 QUIC에 대 한.

Node.js 오류 코드 (`error.code`) 기본값
`'ERR_QUIC_STREAM_ABORTED'`.의 특징 더 구체적인 코드가 필요한 통화
문자열은 `options.code`를 통해 그것을 override 할 수 있습니다 - 숫자 QUIC 코드
불완전하다.

Node.js 오류 코드는 `'ERR_QUIC_STREAM_ABORTED'`에 고정되어 있으므로
붙잡음 구획은 다른 Node.js 오류에서 `QuicError`를 구별할 수 있습니다
프로토 타입 체인을 검사하지 않고. 숫자 QUIC 코드는 삶
별도의 [`error.errorCode`][] 속성과 충돌 방지
`error.code`가 문자열이다.

#### `new QuicError(message, options)`

<!-- YAML
added: v26.2.0
-->

* `message` {string} A human-readable description of the error.
* `options` {Object}
* `errorCode` {bigint | number} 숫자 QUIC 오류 코드. 
`BigInt`에 coerced 입니다. 비 부정적 인 62 비트 할당되어야한다.
varint (`0n <= errorCode <= 2n**62n - 1n`).
* `code` {string} Node.js-style 오류 코드 문자열에 할당된
`error.code`. 기본 `'ERR_QUIC_STREAM_ABORTED'`.
`type` {string} `'application'` (기본) 또는 `'transport'`.
협상된 코드가 정의되었는지 나타냅니다.
애플리케이션 프로토콜 (e.g. RFC 9114 for HTTP/3) 또는 QUIC
전송 층 (RFC 9000). Stream 리셋은 항상 응용을 수행
코드, 그래서 기본 `'application'`입니다.

```mjs
import { QuicError } from 'node:quic';

const err = new QuicError('rejecting stream', { errorCode: 0x10cn });
console.log(err.code);       // 'ERR_QUIC_STREAM_ABORTED'
console.log(err.errorCode);  // 268n
console.log(err.type);       // 'application'

const custom = new QuicError('custom failure', {
  errorCode: 0x10cn,
  code: 'ERR_MY_QUIC_FAILURE',
});
console.log(custom.code);    // 'ERR_MY_QUIC_FAILURE'
```

#### `error.errorCode`

<!-- YAML
added: v26.2.0
-->

* Type: {bigint}

이 오류에 의해 수행 된 숫자 QUIC 오류 코드.

#### `error.type`

<!-- YAML
added: v26.2.0
-->

* Type: {string}

`'application'` 또는 `'transport'`가 있는 경우 namespace의 표시
[`error.errorCode`][].

## 종류: `QuicStream`

<!-- YAML
added: v23.8.0
-->

#### `stream.closed`

<!-- YAML
added: v23.8.0
-->

* Type: {Promise}

스트림이 완전히 닫힐 때 성취되는 약속. 그것은 해결
스트림이 깨끗하게 닫을 때 (idle timeout 포함). 그것은 함께 거부
`ERR_QUIC_APPLICATION_ERROR` 또는 `ERR_QUIC_TRANSPORT_ERROR` 때
스트림은 QUIC 오류로 인해 닫힙니다 (예 : 피어에 의해 스트림 리셋,
CONNECTION\ CLOSE with a non-zero 오류 코드).

#### `stream.destroy([error[, options]])`

<!-- YAML
added: v23.8.0
changes:
  - version: v26.2.0
    pr-url: https://github.com/nodejs/node/pull/62876
    description: Added the `options` parameter accepting `code` and `reason`.
-->

* `error` {any}
* `options` {Object}
* `code` {bigint|number} 응용 프로그램 오류 코드에 포함
`RESET_STREAM` 및 `STOP_SENDING` 프레임이 피어로 전송되었습니다. 번호는
`BigInt`에 coerced. omitted 때, 철사 부호는 `error`에서 파생됩니다
(아래 참조).
* `reason` {string} 선택적인 인간 읽기 쉬운 이유 끈. 자주 묻는 질문
[`session.close()`][]와 [`session.destroy()`][]를 가진 symmetry, 그러나
**- `RESET_STREAM` 또는
`STOP_SENDING`는 이유장을 나릅니다. 앱 로깅에 대한 제공
그리고 [`stream.onerror`][] 콜백의 사용을 위해.

즉시 및 abruptly는 스트림을 파괴합니다. `error`가 제공되고 있는 경우
[`stream.onerror`][] 설정, `onerror` 콜백은 이전
파괴. `stream.closed`는 오류로 거부합니다.

스트림이 `error`로 파괴되면 (또는 명시된 대로)
`options.code`)는, QUIC 더미는 피어에 abort를 신호합니다:

* writable 측이 아직도 열리는 경우에, `RESET_STREAM` 구조는 보내집니다.
* 읽을 수 있는 측이 아직도 열리는 경우에 (지향성 시내, 또는
원격 시작된 단방향 시내), `STOP_SENDING` 구조는 보내집니다.

둘 다 구조는 동일한 철사 부호를, 뒤에 해결했습니다
주의:

1. `options.code`는, 명시적으로 제공될 때.
2. [`error.errorCode`][]는 `error`가 [`QuicError`][]입니다.
3. 협상 된 응용 프로그램 프로토콜의 "내부 오류"코드
(`H3_INTERNAL_ERROR` (`0x102`) HTTP/3, 또는 QUIC 전송 층
`INTERNAL_ERROR` (`0x1`) 원료 QUIC 용.

깨끗한 파괴 - `error` 및 `options.code` - 방출되지 않습니다
`RESET_STREAM` 또는 `STOP_SENDING`; 스트림의 기존 닫기 기계
손잡이 눈물방울.

[Aborting a stream][]를 참조하십시오.
API.

#### `stream.destroyed`

<!-- YAML
added: v23.8.0
-->

* Type: {boolean}

`stream.destroy()`가 호출 된 경우 true.

### Aborting a stream

QuicStream은 세 가지 방법으로 낙관 될 수 있으며 각각 다른 생산
철사 구조 측 효력:

* [`writer.fail(reason)`][] - 쓰기 가능한 측만 분류합니다. 
`RESET_STREAM`는 피어에게. 읽기 쉬운 측은 unaffected; 어떤 자료
이미 읽을 수 있습니다.
* [`stream.destroy()`][] 와 `error` 인수 — 눈물의 흐름
완전하게. `RESET_STREAM`는 어떤 여전히 열려있는 writable 측에 보냅니다
**및**`STOP_SENDING`는 여전히 열려있는 읽기 쉬운 측에. 철사 부호
`error`에서 파생됩니다.
규칙).
* [`stream.destroy()`][]는 명시된 `options.code`를 사용하여
이전 형태하지만 콜러 공급 와이어 코드, 이는 걸립니다
`error`에 의해 수행되는 코드에 대한 우선.

`error`가 [`QuicError`][]일 때, [`error.errorCode`][]는 사용
`writer.fail()` 및 `stream.destroy()` 모두용 와이어 코드. 
구현은 협상 된 애플리케이션 프로토콜의 뒤로 떨어졌다
"내부 오류"코드 ([`QuicError`][] 참조).

#### `stream.early`

<!-- YAML
added: v26.2.0
-->

* Type: {boolean}

이 스트림의 데이터가 0-RTT (early data)로 수신된 경우 true
TLS Handhake가 완료되기 전에. 초기 데이터는 덜 안전하며
잠재적으로 공격자가 재생 될 수 있습니다. 적용사례
적절한 주의를 가진 이른 자료를 대우하십시오.

이 속성은 서버 측에서만 의미 있습니다. 고객에
측, 그것은 항상 `false`입니다.

#### `stream.direction`

<!-- YAML
added: v23.8.0
-->

* Type: {string|null} One of `'bidi'`, `'uni'`, or `null`.

스트림의 방향성, 또는 스트림이 파괴 된 경우 `null`
또는 여전히 종료됩니다. 읽기 전용입니다

#### `stream.highWaterMark`

<!-- YAML
added: v26.2.0
-->

* Type: {number}

작가가 전에 버퍼 할 바이트의 최대 수는
`writeSync()`는 `false`를 반환합니다. 버퍼 데이터가 이 한계를 초과할 때,
콜러는 더 작성하기 전에 배수구를 기다립니다.

값은 언제든지 동적으로 변경 될 수 있습니다. 이것은 특히
`onstream` 콜백을 통해 수신되는 스트림에 유용합니다.
기본적으로 (65536)는 신청 필요에 따라 조정될지도 모릅니다.
유효한 범위는 `0`에 `4294967295`입니다.

#### `stream.id`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|null}

스트림 ID 또는 `null` 스트림이 파괴되거나 여전히
관련 기사 읽기 전용입니다

#### `stream.onerror`

<!-- YAML
added: v26.2.0
-->

* Type: {Function|undefined}

스트림이 오류로 파괴 될 때 옵션 콜백.
이것은 사용자 콜백에 의한 오류가 발생하거나 거부 (see)
[Callback error handling][]). 콜백은 단일 인수를받습니다.
파괴를 유발하는 오류. `onerror` 콜백 자체가 던지면
또는 거부하는 약속을 반환, 오류는 uncaught로 표면
예외. 읽기/쓰기.

#### `stream.onblocked`

<!-- YAML
added: v23.8.0
-->

* Type: {quic.OnBlockedCallback}

스트림이 차단될 때 콜백. 읽기 / 쓰기.

#### `stream.onreset`

<!-- YAML
added: v23.8.0
-->

* Type: {quic.OnStreamErrorCallback}

The callback to invoke when the 피어 aborts a direction of the stream 로
`RESET_STREAM` 프레임을 전송하십시오 ( 피어는 자신의 쓸 수 있는 측을 포기합니다, 그래서
더 이상 자료는 우리의 읽기 쉬운 측에 도착할 것입니다) 또는 `STOP_SENDING`
프레임 (Pr는 우리 writable 측에 쓰기를 중지하도록 요청합니다).

콜백은 `errorCode` (`bigint`)의 Node.js 오류를받습니다.
재산은 철사 구조에서 신청 과실 부호를 나릅니다.

스트림은**이 콜백 화재 때 자동으로 파괴된다 —
응용 프로그램은 반응하는 방법을 선택합니다. 일반적인 패턴은 : 무시 (및
양방향 스트림의 여전히 활성 방향을 계속합니다.
[`writer.fail()`][]와 다른 방향을 구출, 또는 눈물
[`stream.destroy()`][]와 전체 스트림. 읽기 / 쓰기.

#### `stream.headers`

<!-- YAML
added: v26.2.0
-->

* Type: {Object|undefined}

이 스트림에 수신 된 버퍼 초기 헤더, 또는 `undefined` 경우
신청은 우두머리를 지원하지 않습니다 또는 우두머리는 아직 받아졌습니다.
서버 측 스트림의 경우, 이것은 요청 헤더 (예를 들어, `:method`,
`:path`, `:scheme`). 클라이언트 측 시내를 위해, 이것은 응답을 포함합니다
헤더 (예 : `:status`).

헤더 이름은 lowcase 문자열입니다. Multi-value 헤더는
배열. 객체에는 `__proto__: null`가 있습니다.

#### `stream.onheaders`

<!-- YAML
added: v26.2.0
-->

* Type: {Function}

초기 헤더가 스트림에 수신될 때 콜백. 더 보기
콜백은 `(headers)`를 수신합니다. `headers`는 객체입니다.
`stream.headers`). HTTP/3의 경우, 이것은 요청에 가짜 헤더를 전달합니다.
클라이언트 측에 서버 측과 응답 우두머리.
`ERR_INVALID_STATE`는 헤더를 지원하지 않는 세션에 설정하면 됩니다.
읽기/쓰기.

#### `stream.ontrailers`

<!-- YAML
added: v26.2.0
-->

* Type: {Function}

Headers가 피어로부터 수신될 때 호출백.
콜백은 `(trailers)`가 `trailers`가 있는 `(trailers)`를 받습니다.
`stream.headers`와 같은 형식. 설정하면 Throws `ERR_INVALID_STATE`
헤더를 지원하지 않는 세션. 읽기 / 쓰기.

#### `stream.oninfo`

<!-- YAML
added: v26.2.0
-->

* Type: {Function}

informational (1xx) 헤더가 수신 될 때 호출
서버. 콜백은 `(headers)`를 수신합니다. `headers`는 객체입니다.
`stream.headers`와 같은 형식. 본문내용 바로가기
최종 응답 전에 (예 : 103 Early Hints).
`ERR_INVALID_STATE`는 헤더를 지원하지 않는 세션에 설정하면 됩니다.
읽기/쓰기.

#### `stream.onwanttrailers`

<!-- YAML
added: v26.2.0
-->

* Type: {Function}

응용 프로그램이 추적 헤더를 준비 할 때 콜백
전송합니다. 이것은 비동기적으로 호출됩니다 — 사용자는 호출해야합니다
[`stream.sendTrailers()`][] 이 콜백 안에.
`ERR_INVALID_STATE`는 헤더를 지원하지 않는 세션에 설정하면 됩니다.
읽기/쓰기.

#### `stream.pendingTrailers`

<!-- YAML
added: v26.2.0
-->

* Type: {Object|undefined}

어플리케이션 요청시 자동으로 전송됩니다.
그들. 이것은 [`stream.onwanttrailers`][] 콜백에 대안입니다
트레일러가 몸 전체 전에 알려져있는 경우.
`ERR_INVALID_STATE`는 헤더를 지원하지 않는 세션에 설정하면 됩니다.
읽기/쓰기.

#### `stream.sendHeaders(headers[, options])`

<!-- YAML
added: v26.2.0
-->

* `headers` {Object} Header object with string keys and string or
string-array 값입니다. (`:method`, `:path` 등)
일반 헤더 전에 나타납니다.
* `options` {Object}
* Returns: {boolean}
헤더 이후 (본문이 따를 것).**기본값:**`false`.
* Returns: {boolean}

스트림에 초기 또는 응답 헤더를 보냅니다. 클라이언트 측 시내를 위해,
이것은 요청 헤더를 보냅니다. 서버 측 시내를 위해, 이것은 응답을 보냅니다
머리. 세션이 헤더를 지원하지 않는 경우 Throws `ERR_INVALID_STATE`.

#### `stream.sendInformationalHeaders(headers)`

<!-- YAML
added: v26.2.0
-->

* `headers` {Object} Header object. Must include `:status` with a 1xx
값 (예 : `{ ':status': '103', 'link': '</style.css>; rel=preload' }`).
* Returns: {boolean}

정보 전송 (1xx) 응답 헤더. 서버 만.
세션이 헤더를 지원하지 않는 경우 `ERR_INVALID_STATE`.

#### `stream.sendTrailers(headers)`

<!-- YAML
added: v26.2.0
-->

* `headers` {Object} Trailing header object. Pseudo-headers must not be
트레일러에 포함.
* Returns: {boolean}

스트림에 트레일 헤더를 보냅니다. 동시에 호출해야합니다
[`stream.onwanttrailers`][] 콜백, 또는 시간을 통해 설정
[`stream.pendingTrailers`][].의 특징 세션이면 `ERR_INVALID_STATE`를 찾습니다.
헤더를 지원하지 않습니다.

#### `stream.priority`

<!-- YAML
added: v26.2.0
-->

* Type: {Object|null}
* `level` {문자} `'high'`, `'default'` 또는 `'low'`의 하나.
* `incremental` {불린} 스트림 데이터가 interleaved 여부
같은 우선 순위 수준의 다른 스트림.

스트림의 현재 우선 순위. 세션이 아닌 경우 `null` 반환
우선 지원 (예 : non-HTTP/3) 또는 스트림이 파괴 된 경우.
읽기 전용입니다 [`stream.setPriority()`][]를 사용하여 우선 순위를 변경하십시오.

클라이언트 측 HTTP/3 회의에서, 가치는 통해 놓인 것을 반영합니다
[`stream.setPriority()`][] . 서버 측 HTTP/3 세션에서, 값
`PRIORITY_UPDATE` 프레임에서 피어의 요청된 우선 순위를 반영합니다.

#### `stream.setPriority([options])`

<!-- YAML
added: v26.2.0
-->

* `options` {Object}
* `level` {문자} 우선 순위. `'high'`, `'default'`, 또는
`'low'`.**기본값:**`'default'`.
* `incremental` {불린} `true`이 스트림의 데이터가 있을 때
같은 우선 순위의 다른 스트림에서 데이터로 interleaved.
**기본값:**`false`.

스트림의 우선 순위를 설정합니다. 세션이면 `ERR_INVALID_STATE`를 찾습니다.
우선 지원하지 않습니다 (예 : non-HTTP/3). 스트림이 없다면 효과가 없습니다.
파괴되었습니다.

#### `stream[Symbol.asyncIterator]()`

<!-- YAML
added: v26.2.0
-->

* Returns: {AsyncIterableIterator} yielding {Uint8Array\[]}

스트림은 `Symbol.asyncIterator`, 직접 사용 가능
`for await...of` 루프에서. 각 반복은 `Uint8Array`의 배치를 산출합니다
펑크.

1개의 async iterator는 시내 당 얻어질 수 있습니다. 두 번째 호출 던지기
`ERR_INVALID_STATE` . 비 읽기 쉬운 스트림 (outbound-only unidirectional)
또는 닫히는) 즉시 완성되는 iterator를 돌려보냅니다.

```mjs
for await (const chunks of stream) {
  for (const chunk of chunks) {
    // Process each Uint8Array chunk
  }
}
```

stream/iter 유틸리티와 호환 가능:

```mjs
import Stream from 'node:stream/iter';
const body = await Stream.bytes(stream);
const text = await Stream.text(stream);
await Stream.pipeTo(stream, someWriter);
```

#### `stream.writer`

<!-- YAML
added: v26.2.0
-->

* Type: {Object}

데이터를 스트림 incrementally로 밀어주는 작가 객체를 반환합니다.
작가는 stream/iter Writer 인터페이스를 구현합니다.
try-sync-fallback-to-async 패턴.

`body` 소스가 생성 시간에 제공되거나
[`stream.setBody()`][].의 특징 Non-writable 스트림은 이미 닫히는
작가. throws `ERR_INVALID_STATE` 아웃바운드가 이미 구성되는 경우.

작가는 다음과 같은 방법이 있습니다:

* `writeSync(chunk)` - 동시 쓰기. `true`를 반환하면,
통제되는 경우에 `false`. 데이터는 `false`에서 허용되지 않습니다.
* `write(chunk[, options])` - 하수구 대기와 동기화 쓰기. `options.signal`의 특징
항목에 체크하지만 쓰기 중에 관찰되지 않습니다.
* `writevSync(chunks)` - 동시 벡터화 쓰기. 모든 것.
* `writev(chunks[, options])` - 벡터화 쓰기.
* `endSync()` - 동기화 닫기. 총 바이트 또는 `-1`를 반환합니다.
* `end([options])` - 동기화 닫기.
* `fail(reason)` - 스트림을 오류 (`RESET_STREAM`를 피어로 보내십시오).
`reason`가 [`QuicError`][]일 때 [`error.errorCode`][]가 사용됩니다.
결과로 `RESET_STREAM` 구조에 철사 부호로; 그렇지 않으면
철사 부호는 협상된 신청 의정서에 뒤떨어집니다
"내부 오류"코드 (`H3_INTERNAL_ERROR` (`0x102`) HTTP/3, 또는
QUIC 전송 층 `INTERNAL_ERROR` (`0x1`) 원료 QUIC를 위한.
[`stream.destroy()`][]를 참조하여 전체 스트림 abort에 대한
`STOP_SENDING`를 통해 읽기 쉬운 측.
* `desiredSize` - 바이트, 또는 `null`의 사용 가능한 용량은 닫히는/errored 경우.

각 `writeSync()`/`writevSync()`/`write()`/`writev()`의 바이트
입력 펑크는 내부 버퍼로 복사되므로 콜러 소스
버퍼는 변하지 않고 즉시 재사용되거나 mutated 수 있습니다.
호출 반환. 소스 버퍼를 보장하려는 통화는 할 수 없습니다
mutated 후 손을 떨어져 `ArrayBuffer.prototype.transfer()`
버퍼를 통과하기 전에 스스로.

#### `stream.setBody(body)`

<!-- YAML
added: v26.2.0
-->

* `body` {string | ArrayBuffer | SharedArrayBuffer | ArrayBufferView |
Blob | FileHandle | AsyncIterable | Iterable | Promise | null}

스트림의 아웃바운드 바디 소스를 설정합니다. 한 번만 호출 할 수 있습니다.
[`stream.writer`][]와 독점.

다음 신체 소스 유형은 지원됩니다 :

* `null` - 쓰기 가능한 측은 즉시 닫힙니다 (자료 없이 보내지는 FIN).
* `string` - UTF-8 인코딩 및 단일 싱크로 전송.
* `ArrayBuffer`, `SharedArrayBuffer`, `ArrayBufferView` - 단일로 전송
펑크. 바이트는 내부 버퍼로 복사되므로 콜러의
소스 버퍼는 변경되지 않으며 즉시 재사용되거나 mutated 일 수 있습니다
호출 반환 후. 그들의 근원을 지키기 위하여 원하는 통화자는 할 수 없습니다
호출 할 수 있습니다
`ArrayBuffer.prototype.transfer()` 버퍼를 통과하기 전에 스스로.
* `Blob` - Blob의 underlying 데이터 큐에서 전송.
* 파일이름 파일 내용이 비동기적으로 읽습니다.
fd-backed 데이터 소스. `FileHandle`는 독서를 위해 열어야 합니다
([`fs.promises.open(path, 'r')`][]를 통해). 몸으로 전달되면
`FileHandle`는 고정되어 다른 스트림의 몸으로 사용할 수 없습니다.
`FileHandle`는 스트림 마감시 자동으로 닫힙니다.
* `AsyncIterable`, `Iterable` - 각 산출된 펑크 (문자 또는
`Uint8Array`)는 스트리밍 모드에서 incrementally 작성됩니다.
* `Promise` - Awaited; 해결 된 값은 신체 (subject)로 사용됩니다.
동일한 유형 규칙에).

throws `ERR_INVALID_STATE` 아웃바운드가 이미 구성되었거나 경우
작가는 접근했다.

#### `stream.session`

<!-- YAML
added: v23.8.0
-->

* Type: {quic.QuicSession|null}

이 스트림을 만든 세션, 또는 스트림이 있었다면 `null`
파괴. 읽기 전용입니다

#### `stream.stats`

<!-- YAML
added: v23.8.0
-->

* Type: {quic.QuicStream.Stats}

스트림의 현재 통계. 읽기 전용입니다

## 종류: `QuicStream.Stats`

<!-- YAML
added: v23.8.0
-->

#### `streamStats.ackedAt`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `streamStats.bytesAccumulated`

<!-- YAML
added: v26.3.0
-->

* Type: {bigint}

스트림에서 앉아있는 바이트의 현재 수는 축적을받습니다.
완충기, 신청에 기다리는 납품. 0의 값은 나타냅니다.
독자는 들어오는 자료로 유지됩니다. 스트림의 가치
유량 제어 창은 응용 프로그램을 구성하지 않습니다 데이터 빠른
충분합니다.

#### `streamStats.bytesReceived`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `streamStats.bytesSent`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `streamStats.createdAt`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `streamStats.destroyedAt`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `streamStats.finalSize`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `streamStats.isConnected`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `streamStats.maxBytesAccumulated`

<!-- YAML
added: v26.3.0
-->

* Type: {bigint}

스트림에서 축적 된 바이트의 피크 번호
스트림의 수명 동안 어떤 시점에서 버퍼. 이 값만
monotonically 증가하십시오. 그것은 스트림 여부 진단에 유용합니다
숙련 된 backpressure 에피소드와 축적 버퍼 여부
sizing는 workload에 적합합니다.

#### `streamStats.maxOffset`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `streamStats.maxOffsetAcknowledged`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `streamStats.maxOffsetReceived`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `streamStats.openedAt`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

#### `streamStats.receivedAt`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint}

## 유형

### 유형: `ApplicationOptions`

<!-- YAML
added: v26.3.0
-->

* Type: {Object}

특정 옵션.

##### `applicationOptions.maxHeaderPairs`

* Type: {bigint|number}

헤더 블록 당 허용되는 헤더 이름값 쌍의 최대 수.
이 제한을 초과하는 헤더는 침묵적으로 떨어졌다.**기본값:**`128`

##### `applicationOptions.maxHeaderLength`

* Type: {bigint|number}

header 당 결합된 모든 우두머리 이름과 가치의 최대 총 바이트 길이
블록. 이 한계 위에 총을 밀어주는 헤더는 조용히
충분합니다.**기본값:**`8192`

##### `applicationOptions.maxFieldSectionSize`

* Type: {bigint|number}

압축 헤더 필드 섹션 (QPACK)의 최대 크기. `0` 의미
무제한.**기본값:**`0`

##### `applicationOptions.qpackMaxDTableCapacity`

* Type: {bigint|number}

QPACK 동적 테이블 용량을 바이트로 변환합니다. `0`로 동적 설정
테이블.**기본값:**`4096`

##### `applicationOptions.qpackEncoderMaxDTableCapacity`

* Type: {bigint|number}

QPACK 인코더 최대 동적 테이블 용량.**기본값:**`4096`

##### `applicationOptions.qpackBlockedStreams`

* Type: {bigint|number}

QPACK 동적 테이블에 대한 대기를 막을 수있는 스트림의 최대 수
업데이트**기본값:**`100`

##### `applicationOptions.enableConnectProtocol`

* Type: {boolean}

확장된 CONNECT 프로토콜 (RFC 9220)를 가능하게 합니다.**기본값:**`false`

##### `applicationOptions.enableDatagrams`

* Type: {boolean}

HTTP/3 데이터그램 (RFC 9297) 사용 가능.**기본값:**`false`

## 유형: `EndpointOptions`

<!-- YAML
added: v23.8.0
-->

* Type: {Object}

새로운 `QuicEndpoint` 인스턴스를 구성할 때 전달된 엔드포인트 구성 옵션.

##### `endpointOptions.address`

<!-- YAML
added: v23.8.0
-->

* Type: {net.SocketAddress} | string} The local UDP address and port the endpoint should bind to.

endpoint를 지정하지 않으면 임의 포트에 IPv4 `localhost`에 바인딩됩니다.

##### `endpointOptions.blockList`

* Type: {net.BlockList}

옵션 [`net.BlockList`][] 인스턴스 필터링 수신 패킷
소스 주소. 구성될 때, 모든 수신된 UDP 패킷은
QUIC 처리가 발생하기 전에 블록 목록, 자원 최소화
차단된 소스에 expenditure. 블록 목록은 라이브 평가 - 규칙
endpoint가 생성한 후 `BlockList` 객체에 추가되었습니다.
즉시.

[`endpointOptions.blockListPolicy`][]를 참조하세요.

##### `endpointOptions.blockListPolicy`

* Type: {string} One of `'deny'` or `'allow'`.
***기본:**`'deny'`

[`endpointOptions.blockList`][]가 해석되는 방법을 통제합니다:

* `'deny'` - 블록 목록과 일치하는 주소의 패킷은 떨어졌습니다.
다른 모든 주소는 허용됩니다. 이것은 전형적인 blocklist 형태입니다.
* `'allow'` - 블록 목록과 일치하는 주소 만 패킷은
 다른 모든 주소는 떨어졌다. 이 수당 모드입니다.
알려진 클라이언트에 대한 액세스를 제한합니다.

블록 목록이 구성되지 않은 경우,이 옵션은 효과가 없습니다.

##### `endpointOptions.addressLRUSize`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

endpoint는 유효한 소켓 주소의 내부 캐시를 유지합니다
성능 최적화. 이 옵션은 주소의 최대 번호 설정
그것은 캐시. 이것은 사용자가 일반적으로 원하지 않는 고급 옵션입니다.
지정해야 합니다.

##### `endpointOptions.disableStatelessReset`

<!-- YAML
added: v26.2.0
-->

* Type: {boolean}

`true`가 언제, 엔드포인트는 응답에 있는 stateless 리셋 패킷을 보내지 않을 것입니다
알 수없는 연결에서 패킷에. Stateless 리셋은 피어를 감지 할 수 있습니다.
서버가 해당 상태가 없을 때 연결이 손실되었습니다.
그들은 테스트 또는 stateless 재설정이 처리 될 때 유용 할 수있다
다른 층에서.

##### `endpointOptions.idleTimeout`

<!-- YAML
added: v26.2.0
-->

* Type: {number}
* 과태: `0`

몇 초의 끝점은 모든 세션이 끝난 후 살아있을 것입니다.
닫히고 더 이상 듣지 않습니다. `0` (기본값)의 값은
종료점은 `endpoint.close()`를 통해 명시적으로 닫힐 때만 파괴됩니다.
`endpoint.destroy()`. 긍정적 인 가치는 끝점 때 유휴 타이머를 시작합니다.
is idle; 새로운 세션이 타이머 화재 전에 생성되면,
endpoint는 자동으로 파괴됩니다. 연결 풀링에 유용합니다.
향후 `connect()` 통화로 재사용할 수 있는 linger를 간단히 합니다.

##### `endpointOptions.ipv6Only`

<!-- YAML
added: v23.8.0
-->

* Type: {boolean}

`true`일 때, 엔드포인트가 IPv6 주소로만 묶어야 한다.

##### `endpointOptions.reusePort`

<!-- YAML
added:
  - v26.3.0
  - v24.18.0
-->

* Type: {boolean}
* 과태: `false`

`true`가 있을 때, 여러 엔드포인트를 허용할 수 있습니다.
동일한 주소와 항구. 커널은 UDP 데이터그램을 로드밸런스 수신
모든 소켓에 걸쳐이 옵션과 경계. 이것은 수평 스케일링을 가능하게한다.
같은 포트에서 여러 Node.js 프로세스를 실행하여 QUIC 서버.

Linux 3.9+ 및 DragonFlyBSD 3.6+에 지원. 지원되지 않은 플랫폼에서,
bind는 오류로 실패합니다.

##### `endpointOptions.maxConnectionsPerHost`

<!-- YAML
added: v23.8.0
-->

* Type: {number}
* 과태: `0` (무제한)

원격 IP 당 허용되는 동시 세션 수를 지정합니다.
주소 (항구). 제한이 도달되면 새로운 연결
동일한 IP는 `CONNECTION_REFUSED`로 거부됩니다. `0`의 가치
제한 사항 최대 값은 `65535`입니다.

이 한계는 또한 건축을 통해 동적인 변화될 수 있습니다
[`endpoint.maxConnectionsPerHost`][] .

##### `endpointOptions.maxConnectionsTotal`

<!-- YAML
added: v23.8.0
-->

* Type: {number}
* 과태: `0` (무제한)

모든 원격에서 동시 세션의 최대 총 수 지정
 제한이 도달되면 새로운 연결이 거부됩니다.
`CONNECTION_REFUSED` . `0`의 가치는 한계를 비활성화합니다. 최대 값은
`65535`.

이 한계는 또한 건축을 통해 동적인 변화될 수 있습니다
[`endpoint.maxConnectionsTotal`][] .

##### `endpointOptions.retryRate`

* Type: {number}
***기본:**`100`

QUIC 리트리 패킷의 최대 수는 엔드포인트가 초당 전송됩니다.
이것은 전체 서버 전체를 캡스하는 글로벌 속도 제한 (not per-host)입니다
retry 응답률, spoofed-source 홍수를 막기 unbounded
자료실

##### `endpointOptions.retryBurst`

* Type: {number}
***기본:**`200`

제한 속도가 제한되기 전에 허용된 리트리 패킷의 최대 파열.

##### `endpointOptions.statelessResetRate`

* Type: {number}
***기본:**`100`

stateless 리셋 패킷의 최대 수는 엔드포인트가 초당 전송됩니다.

##### `endpointOptions.statelessResetBurst`

* Type: {number}
***기본:**`200`

rate limiting 전에 허용된 stateless 리셋 패킷의 최대 파열
효력이 있습니다.

##### `endpointOptions.versionNegotiationRate`

* Type: {number}
***기본:**`100`

버전 협상 패킷의 최대 수는 엔드 포인트 당 전송됩니다
두 번째.

##### `endpointOptions.versionNegotiationBurst`

* Type: {number}
***기본:**`200`

제한 속도 전에 허용되는 버전 협상 패킷의 최대 파열
효력이 있습니다.

##### `endpointOptions.immediateCloseRate`

* Type: {number}
***기본:**`100`

즉시 연결 닫는 패킷의 최대 수는 엔드포인트가 될 것입니다.
초당 전송.

##### `endpointOptions.immediateCloseBurst`

* Type: {number}
***기본:**`200`

즉시 연결의 최대 파열은 비율 이전에 허용된 패킷을 닫습니다.
제한 효과.

##### `endpointOptions.sessionCreationRate`

* Type: {number}
***기본:**`50`

단일 원격 주소가 만들 수있는 새로운 세션의 최대 수는
두 번째. 이것은 주소 검증 LRU에서 추적하는 per-host rate limit입니다.
캐시. 세션을 통해 churning에서 유효한 원격 주소를 방지합니다.
(rapidly 오프닝 및 버려서 연결) 서버보다 빠른 처리 할 수 있습니다.
트래픽이 단일 소스에서 오는 벤치 마크를 들어,이를 높은 설정
가치.

##### `endpointOptions.sessionCreationBurst`

* Type: {number}
***기본:**`100`

단일 원격 주소에서 허용되는 새로운 세션 생성의 최대 파열
제한이 없는 비율의 앞에 효력.

##### `endpointOptions.retryTokenExpiration`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

QUIC 리트리 토큰의 길이를 지정합니다.

##### `endpointOptions.resetTokenSecret`

<!-- YAML
added: v23.8.0
-->

* Type: {ArrayBufferView}

QUIC 리트리 토큰을 생성하는 데 사용되는 16 바이트 비밀을 지정합니다.

##### `endpointOptions.tokenExpiration`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

QUIC 토큰의 길이를 검증합니다.

##### `endpointOptions.tokenSecret`

<!-- YAML
added: v23.8.0
-->

* Type: {ArrayBufferView}

QUIC 토큰을 생성하는 데 사용되는 16 바이트 비밀을 지정합니다.

##### `endpointOptions.udpReceiveBufferSize`

<!-- YAML
added: v23.8.0
-->

* Type: {number}

##### `endpointOptions.udpSendBufferSize`

<!-- YAML
added: v23.8.0
-->

* Type: {number}

##### `endpointOptions.udpTTL`

<!-- YAML
added: v23.8.0
-->

* Type: {number}

##### `endpointOptions.validateAddress`

<!-- YAML
added: v23.8.0
-->

* Type: {boolean}

`true`의 경우, 리트리 패킷을 사용하여 엔드포인트 검증 피어 주소가 필요합니다.
새로운 연결을 설정하는 동안.

## 유형: `SessionOptions`

<!-- YAML
added: v23.8.0
-->

##### `sessionOptions.alpn`

<!-- YAML
added:
 - v26.1.0
 - v24.16.0
-->

* Type: {string} (client) | {string\[]} (server)

ALPN (Application-Layer Protocol Negotiation) 식별자 (s).

**client**세션은 프로토콜을 지정하는 단일 문자열입니다.
클라이언트는 사용을 원합니다 (예를들면 `'h3'`).

**서버**세션의 경우, 이것은 선호하는 프로토콜 이름의 배열입니다.
서버 지원 (예를들면 `['h3', 'h3-29']`) TLS 중
핸드셰이크, 서버는 목록에서 첫 번째 프로토콜을 선택합니다.
고객 지원

협상 된 ALPN은 애플리케이션 구현이 사용되는 것을 결정합니다.
세션 `'h3'` 및 `'h3-*'` 변형은 HTTP/3을 선택합니다.
응용 프로그램; 다른 모든 값은 기본 응용 프로그램을 선택합니다.

기본: `'h3'`

##### `sessionOptions.application`

<!-- YAML
added: v26.2.0
-->

* Type: {quic.ApplicationOptions}

신청 특정한 선택권.

```mjs
const { listen } = await import('node:quic');

await listen((session) => { /* ... */ }, {
  application: {
    maxHeaderPairs: 64,
    qpackMaxDTableCapacity: 8192,
    enableDatagrams: true,
  },
  // ... other session options
});
```

#### `sessionOptions.ca` (클라이언트 전용)

<!-- YAML
added: v23.8.0
-->

* Type: {ArrayBuffer|ArrayBufferView|ArrayBuffer\[]|ArrayBufferView\[]}

클라이언트 세션에 사용할 CA 인증서. 서버 세션의 경우, CA
인증서는 [`sessionOptions.sni`][]지도에 있는 per-identity를 지정합니다.

##### `sessionOptions.cc`

<!-- YAML
added: v23.8.0
-->

* Type: {string}

혼잡 제어 알고리즘을 지정합니다.
`'reno'`, `'cubic'` 또는 `'bbr'` 중 하나에 설정할 수 있습니다.

일반적으로 지정할 필요가 없습니다 고급 옵션입니다.

#### `sessionOptions.certs` (클라이언트 전용)

<!-- YAML
added: v23.8.0
-->

* Type: {ArrayBuffer|ArrayBufferView|ArrayBuffer\[]|ArrayBufferView\[]}

클라이언트 세션에 사용할 TLS 인증서. 서버 세션의 경우,
인증서는 [`sessionOptions.sni`][]지도에 있는 per-identity를 지정합니다.

##### `sessionOptions.ciphers`

<!-- YAML
added: v23.8.0
-->

* Type: {string}

지원된 TLS 1.3 cipher 알고리즘 목록.

#### `sessionOptions.crl` (클라이언트 전용)

<!-- YAML
added: v23.8.0
-->

* Type: {ArrayBuffer|ArrayBufferView|ArrayBuffer\[]|ArrayBufferView\[]}

클라이언트 세션에 사용할 CRL. 서버 세션의 경우 CRL은 지정됩니다.
[`sessionOptions.sni`][] 지도에 있는 각 IDentity.

##### `sessionOptions.enableEarlyData`

<!-- YAML
added: v26.2.0
-->

* Type: {boolean} **Default:** `true`

`true`이 세션에 대한 TLS 0-RTT 초기 데이터를 가능하게 할 때. 초기 데이터
클라이언트는 TLS Handhake의 앞에 신청 자료를 보낼 수 있습니다
유효 세션 티켓이 될 때 재연결에 대한 대기 시간을 단축
있습니다. 초기 데이터 지원을 비활성화하려면 `false`로 설정하십시오.

##### `sessionOptions.groups`

<!-- YAML
added: v23.8.0
-->

* Type: {string}

지원되는 TLS 1.3 cipher 그룹의 명부.

##### `sessionOptions.keylog`

<!-- YAML
added: v23.8.0
-->

* Type: {boolean}

`true`는 세션에 TLS 키 로깅을 가능하게 합니다. 중요한 물자는 입니다
[`session.onkeylog`][] 콜백에 전달
각 콜백 invocation는 핵심 재료의 단일 라인을받습니다. 산출
Wireshark와 같은 도구를 사용하여 캡처 된 QUIC 트래픽을 해독 할 수 있습니다.

#### `sessionOptions.keys` (클라이언트 전용)

<!-- YAML
added: v23.8.0
changes:
  - version:
     - v25.9.0
     - v24.15.0
    pr-url: https://github.com/nodejs/node/pull/62335
    description: CryptoKey is no longer accepted.
-->

* Type: {KeyObject|KeyObject\[]}

클라이언트 세션에 사용할 TLS 암호화 키. 서버 세션의 경우,
열쇠는 [`sessionOptions.sni`][] 지도에 있는 per-identity를 지정됩니다.

##### `sessionOptions.maxPayloadSize`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

최대 UDP 패킷 페이로드 크기를 지정합니다.

##### `sessionOptions.maxStreamWindow`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

최대 스트림 유량 제어 창 크기를 지정합니다.

##### `sessionOptions.maxWindow`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

최대 세션 유량 제어 창 크기를 지정합니다.

##### `sessionOptions.minVersion`

<!-- YAML
added: v23.8.0
-->

* Type: {number}

최소 QUIC 버전 번호 허용. 이것은 사용자에게 고급 옵션입니다.
일반적으로 지정할 필요가 없습니다.

##### `sessionOptions.preferredAddressPolicy`

<!-- YAML
added: v23.8.0
-->

* Type: {string} One of `'use'`, `'ignore'`, or `'default'`.
***기본:**`'ignore'`

리모트 피어가 선호한 주소를 광고할 때, 이 옵션은
그것을 사용하거나 무시합니다. 기본값은 `'ignore'`로 서버의 명예를 부여하기 때문에
선호하는 주소는 클라이언트가 다른 IP에 그것의 연결을 migrate
data exfiltration attacks에 적용 할 수있는 주소
네트워크 수준에서 합법적 인 QUIC 연결 마이그레이션에서 indistinguishable.
`'use'`로 설정하여 원하는 신뢰할 수 있는 서버에 연결
주소 이동.

##### `sessionOptions.qlog`

<!-- YAML
added: v23.8.0
-->

* Type: {boolean}

`true`를 사용할 때 세션에 [qlog][] 진단 출력이 가능합니다. Qlog 자료
[`session.onqlog`][] 콜백에 전달됩니다.
형식 텍스트. 산출은 qlog 시각화 도구로 해석될 수 있습니다
[qvis][]와 같은.

##### `sessionOptions.sessionTicket`

<!-- YAML
added: v23.8.0
-->

* Type: {ArrayBufferView} A session ticket to use for 0RTT session resumption.

##### `sessionOptions.datagramDropPolicy`

<!-- YAML
added: v26.2.0
-->

* Type: {string}
***기본:**`'drop-oldest'`

datagram을 삭제할 때 데이터그램을 통제하십시오
([`session.maxPendingDatagrams`][]의 크기)는 가득합니다. 한 번에
`'drop-oldest'`
`'drop-newest'` ( 들어오는 datagram를 거부). Dropped 데이터그램은
`ondatagramstatus` 콜백을 통해 손실 된 것으로보고되었습니다.

이 옵션은 세션 생성 후 immutable입니다.

##### `sessionOptions.streamIdleTimeout`

* Type: {bigint|number}
***기본값:**`30000` (30 초)

피어 시작된 스트림이 idle 될 수있는 밀리 초의 최대 시간
(받은 데이터 없음) 자동 파괴되기 전에. 이 보호
리모트 피어가 스트림을 열지 않는 느린 스타일 공격에 대하여
데이터 전송, 서버 리소스를 무한하게 유지. 만 피어 - 시작
streams are check — 현지에서 시작된 스트림은 응용 프로그램의
책임. 비활성화 `0`로 설정합니다.

idle 체크는 정상적인 send 처리 반복의 부분으로, 그래서 추가합니다
추가 타이머 또는 이벤트 루프 오버 헤드 없음. 더 보기
`session.stats.streamsIdleTimedOut` 카운터는 얼마나 많은 스트림이 있었는지 추적합니다.
이 메커니즘에 의해 파괴.

##### `sessionOptions.maxDatagramSendAttempts`

* Type: {number}
***기본:**`5`

`SendPendingData` 주기의 최대 수는 datagram를 생존할 수 있습니다
그것을 포기하기 전에 보내지 않고. 데이터그램이 없을 때
혼잡 통제 또는 소포 크기 constraints 때문에, 그것은 남아 있습니다
큐와 시도 카운터 증가. 제한이 있으면
도달한 데이터그램은 `'abandoned'`로 삭제되고 보고됩니다
`ondatagramstatus` 콜백. 유효한 범위: `1`에 `255`.

##### `sessionOptions.drainingPeriodMultiplier`

<!-- YAML
added: v26.2.0
-->

* Type: {number}
***기본:**`3`

Probe Timeout (PTO)에 적용되는 멀티 플라이어 배수
기간 기간 후 `CONNECTION_CLOSE` 프레임에서 피어.
RFC 9000 단면도 10.2는 적어도를 위한 persist에 배수 기간을 요구합니다
3배 현재 PTO. 유효한 범위는 `3`에 `255`입니다. 아래 값
`3`는 `3`로 클램프됩니다.

##### `sessionOptions.handshakeTimeout`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

최대 수 밀리 초의 TLS Handhake를 지정할 수 있습니다
타이밍 전에 완료.

##### `sessionOptions.initialRtt`

<!-- YAML
added: v26.3.0
-->

* Type: {bigint|number}
***기본값:**`0` (333ms의 ngtcp2 디폴트 사용)

milliseconds의 초기 왕복 시간 견적을 지정합니다. 이 값은
프로브 타임아웃(PTO) 계산, 초기 패딩 및 초기 손실
첫번째 실제적인 RTT 표본의 앞에 탐지는 연결에서 수집됩니다.
333ms의 기본은 일반 인터넷에 적합합니다. 저편성
루프백 또는 동일한 균열 배포와 같은 환경, 값을 더 가까이 설정
실제 RTT (예를들면 `1`)는 비정상적으로 보수적인 초기를 피합니다.
행동.

##### `sessionOptions.keepAlive`

<!-- YAML
added: v26.2.0
-->

* Type: {bigint|number}
***기본값:**`0` (disabled)

milliseconds에서 유지 보수 시간 초과를 지정합니다. 비-제로 설정할 때
가치, PING 구조는 연결 살아남기 위하여 자동적으로 보내질 것입니다
idle timeout 불의 앞에. 값은 유효하다
idle timeout (`maxIdleTimeout` 전송 모수)는 유용합니다.

#### `sessionOptions.verifyPeer` (클라이언트 전용)

* Type: {string} One of `'strict'`, `'auto'`, or `'manual'`.
***기본:**`'auto'`

클라이언트가 서버 인증서 검증을 처리하는 방법을 제어:

* `'strict'` - 서버의 경우 TLS Handhake를 즉시 제거
인증서는 유효성을 실패합니다. `session.opened`는 다시 주사합니다
TLS 오류. 신청은 인증서 또는 오류를 검사할 수 없습니다
 이것은 가장 안전한 형태입니다.

* `'auto'` - TLS Handhake는 유효성 결과에 관계없이 완료됩니다.
유효성 검사가 실패하면 `session.opened`는 오류로 거부됩니다.
검증된 이유를 포함하고, 세션은 파괴된다. 더 보기
`onhandshake` 콜백 (설정) 거부 전에 화재, 진단 허용
로그인. 이것은 기본적으로 `tls.connect()`의 동작과 일치
`rejectUnauthorized: true`로.

* `'manual'` - TLS Handhake는 유효성 결과에 관계없이 완료됩니다.
`session.opened`는 Handhake info로 해결합니다.
유효한 경우에 `validationErrorReason`와 `validationErrorCode`. 더 보기
응용 프로그램은 이러한 값을 검사하고 여부를 결정합니다.
계속. 사용자 정의 유효성 논리, 인증서 pinning, 또는이 모드를 사용
자기 서명 인증서를 의도적으로 수용합니다.

#### `sessionOptions.servername` (클라이언트 전용)

<!-- YAML
added: v23.8.0
-->

* Type: {string}

대상에 피어 서버 이름 (SNI). 기본 `'localhost'`.

#### `sessionOptions.sni` (서버 전용)

<!-- YAML
added:
 - v26.1.0
 - v24.16.0
-->

* Type: {Object}

Server Name의 TLS ID 옵션에 호스트 이름을 매핑하는 객체
표시 (SNI) 지원. 서버 세션이 필요하며,
적어도 1개의 입장을 포함합니다. 특별한 열쇠 `'*'`는 선택을 지정합니다
다른 호스트 이름 일치가 없을 때 사용되는 default/fallback identity. 없음
wildcard 항목은 제공, 인식되지 않은 서버 이름과 연결
TLS `unrecognized_name` 경고로 거부됩니다. 각 항목은
포함 :

* `keys` {KeyObject|KeyObject\[]} The TLS private keys. **Required.**
* `certs` {ArrayBuffer|ArrayBufferView|ArrayBuffer\[]|ArrayBufferView\[]}
TLS 인증서.**필수.**
선택적인 인증서 revocation 명부.
* `verifyPrivateKey` {boolean} Verify the private key. Default: `false`.
* `port` {number} The port to advertise in ORIGIN frames (RFC 9412) for
이 호스트 이름.**기본값:**`443`. HTTP/3 세션에만 사용됩니다.
* `authoritative` {boolean} Whether to include this host name in ORIGIN
구조.**기본값:**`true`. 호스트 이름을 제외한 `false`로 설정
ORIGIN 광고에서. Wildcard (`'*'`) 항목은 항상
이 설정에 관계없이 제외됩니다.

```mjs
const endpoint = await listen(callback, {
  sni: {
    '*': { keys: [defaultKey], certs: [defaultCert] },
    'api.example.com': { keys: [apiKey], certs: [apiCert], port: 8443 },
    'www.example.com': { keys: [wwwKey], certs: [wwwCert], ca: [customCA] },
    'internal.example.com': { keys: [intKey], certs: [intCert], authoritative: false },
  },
});
```

공유 TLS 옵션 (`ciphers`, `groups`, `keylog` 및 `verifyClient`와 같은)
세션 옵션의 최상위에 지정되며 모두 적용
 각 SNI 입장은 per-identity 인증서만 배부합니다
사이트 맵

SNI 지도는 `endpoint.setSNIContexts()`를 사용하여 런타임에 대체될 수 있습니다,
기존 세션 동안 새로운 세션에 대한 맵을 원자로 교환
자신의 정체성을 계속합니다.

##### `sessionOptions.tlsTrace`

<!-- YAML
added: v23.8.0
-->

* Type: {boolean}

TLS 추적 출력을 가능하게하는 True.

#### `sessionOptions.token` (클라이언트 전용)

<!-- YAML
added: v26.2.0
-->

* Type: {ArrayBufferView}

이전에 서버에서 수신 한 opaque 주소 검증 토큰
[`session.onnewtoken`][] 콜백을 통해. 유효한 토큰 제공
reconnection은 클라이언트가 서버의 주소 검증을 건너는 것을 허용합니다.
Handhake 대기 시간을 감소.

##### `sessionOptions.transportParams`

<!-- YAML
added: v23.8.0
-->

* Type: {quic.TransportParams}

QUIC 전송 매개 변수는 세션에 사용됩니다.

##### `sessionOptions.unacknowledgedPacketThreshold`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

unacknowledged 패킷의 최대 수를 지정합니다.

##### `sessionOptions.rejectUnauthorized`

<!-- YAML
added: v26.2.0
-->

* Type: {boolean} **Default:** `true`

`true`가 있다면, 피어 인증서는 공급된 CA 목록에서 확인됩니다.
오류는 검증이 실패하면 방출됩니다. 오류는 통해 검사 될 수 있습니다.
`validationErrorReason` 및 `validationErrorCode` 필드
Handhake 콜백. `false`, 피어 인증 오류가 발생하면


##### `sessionOptions.reuseEndpoint`

<!-- YAML
added: v26.2.0
-->

* Type: {boolean}
* 과태: `true`

`true` (기본값)의 경우 `connect()`는 기존의 재사용을 시도합니다.
각 세션에 대한 새로운 것을 만드는 것보다 끝점. 이 제공
연결 풀 행동 — 여러 세션은 단일 UDP를 공유할 수 있습니다
소켓. 재사용 논리는 듣는 endpoint를 반환하지 않습니다.
연결 대상과 같은 주소 (CID 룰렛 충돌 방지).

`false`로 설정하여 세션의 새로운 엔드포인트 생성을 강제합니다. 
endpoint 고립이 요구될 때 유용합니다 (예를들면, stateless를 시험하십시오
소스 포트 정체성을 재시동합니다.

##### `sessionOptions.verifyClient`

<!-- YAML
added: v23.8.0
-->

* Type: {boolean}

TLS 클라이언트 인증서의 검증을 요구하는 True.

#### `sessionOptions.verifyPrivateKey` (클라이언트 전용)

<!-- YAML
added: v23.8.0
-->

* Type: {boolean}

클라이언트 세션에 대한 개인 키 검증을 요구합니다. 서버
세션은, 이 옵션은 per-identity로 지정됩니다.
[`sessionOptions.sni`][] 지도.

##### `sessionOptions.version`

<!-- YAML
added: v23.8.0
-->

* Type: {number}

QUIC 버전 번호 사용. 이것은 일반적으로 사용자의 고급 옵션입니다.
지정할 필요가 없습니다.

## 유형: `TransportParams`

<!-- YAML
added: v23.8.0
-->

`TransportParams` 유형은 QUIC 전송 모수를 나타냅니다
세션 설립 중 협상 이 모수는 때 사용됩니다
세션 만들기. 협상 된 값은 통해 관찰 될 수 있습니다
`session.localTransportParams` 및 `session.remoteTransportParams` 속성.

##### `transportParams.initialSCID`

<!-- YAML
added: v26.3.0
-->

* Type: {string}

초기 소스 연결 ID (SCID) 지정. 이 필드는 무시됩니다
세션 생성 및 정보 목적으로만 제공
`session.localTransportParams`에서 사용 가능
`session.remoteTransportParams` 속성.

##### `transportParams.originalDCID`

<!-- YAML
added: v26.3.0
-->

* Type: {string}

지정된 원래 목적지 연결 ID (DCID). 이 분야는
세션 생성에 무시하고 정보 제공
`session.localTransportParams` 및
`session.remoteTransportParams` 속성.

##### `transportParams.preferredAddressIpv4`

<!-- YAML
added: v23.8.0
-->

* Type: {net.SocketAddress} The preferred IPv4 address to advertise (only
서버에서 사용).

##### `transportParams.preferredAddressIpv6`

<!-- YAML
added: v23.8.0
-->

* Type: {net.SocketAddress} The preferred IPv6 address to advertise (only
서버 사용)

##### `transportParams.initialMaxStreamDataBidiLocal`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

##### `transportParams.initialMaxStreamDataBidiRemote`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

##### `transportParams.initialMaxStreamDataUni`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

##### `transportParams.initialMaxData`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

##### `transportParams.initialMaxStreamsBidi`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

##### `transportParams.initialMaxStreamsUni`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

##### `transportParams.maxIdleTimeout`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

##### `transportParams.activeConnectionIDLimit`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

##### `transportParams.ackDelayExponent`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

##### `transportParams.maxAckDelay`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}

##### `transportParams.maxDatagramFrameSize`

<!-- YAML
added: v23.8.0
-->

* Type: {bigint|number}
***기본:**`1200`

DATAGRAM 프레임 페이로드의 바이트의 최대 크기이 엔드포인트
수신할 수 있습니다. `0`로 설정하여 데이터그램 지원을 비활성화합니다.
이 값보다 더 큰 datagrams를 보낼 수 없습니다. 실제 최대 크기
a datagram that can be  sent 는 피어의 결정
`maxDatagramFrameSize`, 이 엔드포인트의 값이 아닙니다.

##### `transportParams.retrySCID`

<!-- YAML
added: v26.3.0
-->

* Type: {string}

지정된 재량 연결 ID. 이 필드는 생성에 무시됩니다
세션의 내용은 정보 목적으로만 제공됩니다.
`session.localTransportParams`에서 사용 가능
`session.remoteTransportParams` 속성.

## 콜백

## Callback error handling

모든 세션 및 스트림 콜백은 동시 함수 또는 async일 수 있습니다.
기능. 콜백이 비동기적으로 던져거나 약속을 반환하면
rejects, 오류가 붙고 자체 세션이나 스트림이 파괴됩니다.
그 오류:

* 스트림 콜백 (`onblocked`, `onreset`, `onheaders`, `ontrailers`,
`oninfo`, `onwanttrailers`): 스트림이 파괴됩니다.
* 세션 콜백 (`onapplication`, `onstream`, `ondatagram`,
`ondatagramstatus`, `onpathvalidation`, `onsessionticket`,
`onnewtoken`, `onversionnegotiation`, `onorigin`, `ongoaway`,
`onhandshake`, `onkeylog`, `onqlog`) : 세션은 따라 파괴된다
모든 스트림.

파괴의 앞에, 선택적인 [`session.onerror`][] 또는
[`stream.onerror`][] 콜백은 invoked (if set)이며 응용 프로그램을 제공합니다.
오류를 관찰하거나 로그 할 수있는 기회. `session.closed` 또는 `stream.closed`
약속은 오류로 거부됩니다.

`onerror` 콜백 자체가 던져진 경우, 거부하는 약속을 반환합니다.
`onerror`에서 오류가 발생했습니다.

## 콜백: `OnSessionCallback`

<!-- YAML
added: v23.8.0
-->

* `this` {quic.QuicEndpoint}
* `session` {quic.QuicSession}

새로운 세션이 원격 피어에 의해 시작될 때 호출 기능.

## 콜백: `OnStreamCallback`

<!-- YAML
added: v23.8.0
-->

* `this` {quic.QuicSession}
* `stream` {quic.QuicStream}

## 콜백: `OnDatagramCallback`

<!-- YAML
added: v23.8.0
-->

* `this` {quic.QuicSession}
* `datagram` {Uint8Array}
* `early` {boolean}

## 콜백: `OnDatagramStatusCallback`

<!-- YAML
added: v23.8.0
-->

* `this` {quic.QuicSession}
* `id` {bigint}
* `status` {string} One of `'acknowledged'`, `'lost'`, or `'abandoned'`.
`'acknowledged'`는 피어 확인 영수증을 의미합니다. `'lost'`는
datagram은 전송되었지만 네트워크는 그것을 잃었습니다. `'abandoned'`는
datagram는 결코 철사에 보내지 않았습니다 (queue 과잉 교류 때문에,
시도 제한을 초과, 또는 프레임 크기 거부).

## 콜백: `OnApplicationCallback`

<!-- YAML
added: v23.8.0
-->

* `this` {quic.QuicSession}
* `applicationoption` {quic.QuicSession}

Application 옵션이 변경 될 때 호출 기능.
E.g. http/3 설정은 애플리케이션 옵션과 함께 제공됩니다.
연결이 설치된 후에 도착할지도 모릅니다.

## 콜백: `OnPathValidationCallback`

<!-- YAML
added: v23.8.0
-->

* `this` {quic.QuicSession}
* `result` {string} One of either `'success'`, `'failure'`, or `'aborted'`.
* `newLocalAddress` {net.SocketAddress} The local address of the validated path.
* `newRemoteAddress` {net.SocketAddress} The remote address of the validated path.
* `oldLocalAddress` {net.SocketAddress | null} The local address of the previous
경로, 또는 `null` 이 첫번째 경로 검증 (예를들면, 선호 주소
클라이언트의 관점에서 이동).
* `oldRemoteAddress` {net.SocketAddress | null} The remote address of the previous
경로, 또는 `null`.
* `preferredAddress` {boolean} `true` if the path validation was triggered by
클라이언트 측에 선호되는 주소 이동. 서버 측에 `undefined`.

## 콜백: `OnSessionTicketCallback`

<!-- YAML
added: v23.8.0
-->

* `this` {quic.QuicSession}
* `ticket` {Object}

## 콜백: `OnVersionNegotiationCallback`

<!-- YAML
added: v23.8.0
-->

* `this` {quic.QuicSession}
* `version` {number} The QUIC version that was configured for this session
(서버가 지원하지 않은 버전).
`requestedVersions` {number\[]} 서버에 의해 광고 된 버전
버전 협상 패킷. 이 버전은 서버 지원입니다.
`supportedVersions` {number\[]} 로컬로 지원되는 버전, 표현
2 등급 배열 `[minVersion, maxVersion]`로.

서버가 클라이언트의 초기 패킷에 응답할 때 호출
버전 Negotiation 패킷, 클라이언트에 의해 사용되는 버전을 나타내는
지원되지 않습니다. 세션은 항상이 후 즉시 파괴됩니다.
콜백 반환.

## 콜백: `OnHandshakeCallback`

<!-- YAML
added: v23.8.0
-->

* `this` {quic.QuicSession}
* `info` {Object} The same object that `session.opened` resolves with.
* `local` {net.SocketAddress} 로컬 소켓 주소.
* `remote` {net.SocketAddress} 원격 소켓 주소.
* `servername` {string} SNI 서버 이름은 Handhake 도중 협상했습니다.
* `protocol` {string} Handhake에서 협상 된 ALPN 프로토콜.
* `cipher` {string} 협상 된 TLS cipher 스위트의 이름.
* `cipherVersion` {string} cipher Suite의 TLS 프로토콜 버전.
* `validationErrorReason` {string} 인증이 실패한 경우,
이유 문자열. 유효성 검사가 성공하면 빈 문자열.
* `validationErrorCode` {number} 인증이 실패한 경우,
오류 코드. 유효한 경우에 `0`.
* `earlyDataAttempted` {불린} 0-RTT 초기 데이터가 시도되었는지 여부.
* `earlyDataAccepted` {불린} 0-RTT 초기 데이터가 허용되지 않습니다.

## 콜백: `OnNewTokenCallback`

<!-- YAML
added: v26.2.0
-->

* `this` {quic.QuicSession}
* `token`  NEW\ TOKEN 토큰 데이터.
* `token` {Buffer} The NEW\_TOKEN token data.

## 콜백: `OnOriginCallback`

<!-- YAML
added: v26.2.0
-->

* `this` {quic.QuicSession}
* `origins` {string\[]} The list of origins the server is authoritative for.

## 콜백: `OnKeylogCallback`

<!-- YAML
added: v26.2.0
-->

* `this` {quic.QuicSession}
* `line` {string} A single line of [NSS Key Log Format][] text, including
a trailing newline 문자.

TLS 키 재료가 사용할 때 호출됩니다. 화재 만
[`sessionOptions.keylog`][]는 `true`입니다. 다수 선은 도중 방출됩니다
TLS 1.3 Handhake, 각 포함 비밀 라벨, 클라이언트 무작위, 과
비밀 값.

## 콜백: `OnQlogCallback`

<!-- YAML
added: v26.2.0
-->

* `this` {quic.QuicSession}
* `data` {string} A chunk of [JSON-SEQ][] formatted [qlog][] data.
* `fin` {boolean} `true` if this is the final qlog chunk for the session.

qlog 진단 데이터가 사용할 때 호출됩니다. 화재 만
[`sessionOptions.qlog`][]는 `true`입니다. `data` 펑크는
완전한 qlog 산출을 생성하기 위하여 concatenated. `fin`가 있을 때
`true`, 더 많은 펑크는 방출되고 concatenated 결과는 입니다
JSON-SEQ 문서 완료

## 콜백: `OnBlockedCallback`

<!-- YAML
added: v23.8.0
-->

* `this` {quic.QuicStream}

## 콜백: `OnStreamErrorCallback`

<!-- YAML
added: v23.8.0
-->

* `this` {quic.QuicStream}
* `error` {any}

## 콜백: `OnHeadersCallback`

<!-- YAML
added: v26.2.0
-->

* `this` {quic.QuicStream}
* `headers` {Object} Header object with lowercase string keys and
문자열 또는 문자열-array 값.

초기 요청 또는 응답 헤더가 수신되면 호출됩니다. HTTP/3의 경우
이것은 서버와 응답 헤더에 대한 요청 가짜 헤더를 제공합니다
고객에.

## 콜백: `OnTrailersCallback`

<!-- YAML
added: v26.2.0
-->

* `this` {quic.QuicStream}
* `trailers` {Object} Trailing header object.

Headers가 피어에게서 받을 때 호출됩니다.

## 콜백: `OnInfoCallback`

<!-- YAML
added: v26.2.0
-->

* `this` {quic.QuicStream}
* `headers` {Object} Informational header object.

informational (1xx) 헤더가 서버에서 수신 될 때 호출
(예, 103 초기 힌트).

## HTTP/3 지원

<!-- YAML
added: v26.2.0
-->

협상 된 ALPN 식별자는 `'h3'` (또는 `'h3-*'` 중 하나
초안 변형), QUIC 세션은 HTTP/3 응용 프로그램을 백업
작성자: `nghttp3` `'h3'`는 `quic.connect()`의 기본 ALPN이며
`quic.listen()`, 그래서 HTTP/3 당신이 선택하지 않는 한 당신이 얻을 것 이다
명시적으로 다른 ALPN.

HTTP/3 응용 프로그램을 선택하면 스트림의 수와
non-HTTP/3에 사용할 수없는 세션 레벨 기능
신청:

***헤더 및 트레일러**- 요청 및 응답 헤더 블록
(`:method`, `:path`, `:scheme`와 같은 가짜 머리,
`:authority` 및 `:status`), 트레일 헤더 및 정보
(`1xx`) 응답. [`stream.sendHeaders()`][] 참조,
[`stream.sendTrailers()`][], 그리고
[`stream.sendInformationalHeaders()`][].
***스트림 우선 순위 (RFC 9218)**- 스트림 긴급 및
incremental 플래그. [`stream.priority`][] 참조
[`stream.setPriority()`][].
***HTTP/3 데이터그램 (RFC 9297)**- 신뢰할 수있는 응용 층
데이터그램. 피어는 `SETTINGS_H3_DATAGRAM=1`를 광고해야 합니다.
[`application.enableDatagrams`][]를 `true`로 설정하여 활성화
둘 다 피어에. [`session.sendDatagram()`][] 참조
[`session.ondatagram`][].
***ORIGIN 프레임 (RFC 9412)**- 서버는 자동으로 광고
[`sessionOptions.sni`][] 지도에서 호스트 이름 (과함)
`authoritative: true`); 클라이언트는 목록을 통해 받습니다
[`session.onorigin`][].
***GOAWAY**- 우아한 폐쇄. 서버는 `GOAWAY`를 부분으로 방출합니다
[`session.close()`][]; 클라이언트는 그것을 통해 관찰합니다
[`session.ongoaway`][]를 열고 새로운 양방향 스트림을 엽니다.
***CONNECT 설정 확장 (RFC 9220)**—
`SETTINGS_ENABLE_CONNECT_PROTOCOL` 설정을 통해 사용할 수 있습니다
[`application.enableConnectProtocol`][]. 설정은 교환
그러나 신청은 `:protocol`를 취급하는 책임입니다
가짜 머리글자 및 위에 어떤 payload framing.
***QPACK 튜닝**- 동적 테이블 크기 및 블록 스트림 제한
[`application.qpackMaxDTableCapacity`][] 및 친구를 통해.

## Minimal HTTP/3 클라이언트

```mjs
import { connect } from 'node:quic';
import process from 'node:process';

const session = await connect('example.com:443', {
  // ALPN defaults to 'h3'.
  servername: 'example.com',
});
await session.opened;

const stream = await session.createBidirectionalStream({
  headers: {
    ':method': 'GET',
    ':path': '/',
    ':scheme': 'https',
    ':authority': 'example.com',
  },
  onheaders(headers) {
    console.log('status:', headers[':status']);
  },
});

const decoder = new TextDecoder();
for await (const chunks of stream) {
  for (const chunk of chunks) {
    process.stdout.write(decoder.decode(chunk, { stream: true }));
  }
}

await session.close();
```

몇 가지 주의:

* 자동 `session.createBidirectionalStream({ headers })`
`body`가 제공되지 않을 때 터미널으로 HEADERS 프레임을 표시합니다.
요청은 `HEADERS`에 따라 `END_STREAM`입니다.
* `onheaders` 콜백은 응답 pseudo-headers와 수신
Lowercase 문자열 키와 단일 객체의 일반 헤더.
콜백 반환 후, 같은 객체도 접근 가능
[`stream.headers`][]를 통해.
* 독서 `for await (const chunks of stream)`는 응답을 소모합니다
몸. 각 반복은 펑크의 `Uint8Array[]` 배치를 산출합니다.
* HTTP semantic helpers (URL 파싱, 방법 / 통계 검증,
리디렉션, 콘텐츠 협상 등
에 내장. 콜러는 HTTP 수준의 처리에 책임이 있습니다.
철사 framing 보다는.

## Minimal HTTP/3 서버

```mjs
import { listen } from 'node:quic';

const encoder = new TextEncoder();

const endpoint = await listen((session) => {
  // The session.onstream callback fires for each new client-initiated stream.
}, {
  sni: { '*': { keys: [defaultKey], certs: [defaultCert] } },
  // ALPN defaults to 'h3'.
  onheaders(headers) {
    // `this` is the QuicStream. Pseudo-headers are available on the
    // request header block (`:method`, `:path`, `:scheme`,
    // `:authority`).
    if (headers[':path'] === '/health') {
      this.sendHeaders({ ':status': '200', 'content-type': 'text/plain' });
      const w = this.writer;
      w.writeSync(encoder.encode('ok\n'));
      w.endSync();
    } else {
      this.sendHeaders({ ':status': '404' }, { terminal: true });
    }
  },
});

console.log('listening on', endpoint.address);
```

서버 측 주:

* `onheaders`를 [`listen()`][`quic.listen()`] 수준 설정
모든 수신 스트림에 적용 (그것은 전에 유선
`onstream` 화재). `onstream` 내부 설정
HTTP/3, 요청 헤더 프레임은 첫 번째 일이다
스트림에 도착.
* `this.sendHeaders(headers, { terminal: true })` 마크
응답 HEADERS 구조 맨끝으로 (본문은 따릅니다).
* 몸 응답을 위해, headers를 첫째로 보내십시오, 그 후에 쓰기
`this.writer`와 `endSync()`를 호출하여 본문을 보내고 닫습니다.
깨끗한 스트림.

### 구현되지 않음

***서버 푸시**- `PUSH_PROMISE` 및 관련 푸시 스트림
기계가 구현되지 않고 주변 기기에 없습니다.
로드맵. Server Push는 연습에서 제한된 배포, 대부분
사용 사례는 Early Hints (`103`) 또는 직접 제공
클라이언트에서 fetches.
***WebTransport / 확장 커넥터 헬퍼**—
`SETTINGS_ENABLE_CONNECT_PROTOCOL` 설정 협상 할 수 있지만
`:protocol` 가짜 헤더에 대한 내장 지원이 없습니다.
WebTransport datagram demultiplexing, 또는 캡슐 framing.
***Higher-level HTTP semantics**- 내장이 없습니다
request/response 라우터, URL 파싱, 콘텐츠 인코딩
협상, 몸 유형 coercion, 뒤에 리디렉션, 또는
쿠키 취급 이것은 더 높은 수준으로 왼쪽
`node:quic`의 상단에 내장 된 라이브러리.

## 성능 측정

<!-- YAML
added: v26.2.0
-->

QUIC 세션, 스트림 및 엔드 포인트는 [`PerformanceEntry`][] 개체를 방출
`entryType`는 `'quic'`로 설정합니다. 이 항목은 단지 만들 때
[`PerformanceObserver`][]는 `'quic'` 입력 유형을 관찰하고, 지키십시오
사용할 때 0 오버 헤드.

각 항목 제공:

* `name` {문자} `'QuicEndpoint'`, `'QuicSession'` 또는 `'QuicStream'`의 하나.
* `entryType` {string} 항상 `'quic'`.
* `startTime` {number} 객체가 생성되었을 때 고해상도 타임스탬프 (ms).
* `duration` {number} 창조에서 파괴에 milliseconds에서 일생.
* `detail` {Object} 입력 별 메타데이터 (아래 참조).

### `QuicEndpoint` 항목

* `detail.stats` {QuicEndpointStats} The endpoint's statistics object
( 파괴 시간).

### `QuicSession` 항목

* `detail.stats` {QuicSessionStats} The session's statistics object
( 파괴 시간). 전송되는 바이트를 포함합니다/received, RTT
측정, 혼잡 창, 패킷 카운트 및 더 많은.
* `detail.handshake` {Object|undefined} Timing-relevant handshake metadata,
또는 `undefined`는 파괴 전에 완료하지 않았다.
* `detail.path` {Object|undefined} The session's network path, or
* `protocol` {string} 협상 된 ALPN 프로토콜.
* `earlyDataAttempted` {불린} 0-RTT 초기 데이터가 시도되었는지 여부.
* `earlyDataAccepted` {불린} 0-RTT 초기 데이터가 허용되지 않습니다.
* `detail.path` {Object undefined} 세션의 네트워크 경로, 또는
아직 설치되지 않은 경우 `undefined`.
* `local` {net.SocketAddress}
* `remote` {net.SocketAddress}

### `QuicStream` 항목

* `detail.stats` {QuicStreamStats} The stream's statistics object
( 파괴 시간). 전송/received, 타이밍 포함
timestamps 및 오프셋 추적.
* `detail.direction` {string} Either `'bidi'` or `'uni'`.

### 예제

```mjs
import { PerformanceObserver } from 'node:perf_hooks';

const obs = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.duration.toFixed(1)}ms`);
    if (entry.name === 'QuicSession') {
      const { stats, handshake } = entry.detail;
      console.log(`  protocol: ${handshake?.protocol}`);
      console.log(`  bytes sent: ${stats.bytesSent}`);
      console.log(`  smoothed RTT: ${stats.smoothedRtt}ns`);
    }
  }
});
obs.observe({ entryTypes: ['quic'] });
```

## 진단 채널

## 채널: `quic.endpoint.created`

<!-- YAML
added: v23.8.0
-->

* `endpoint` {quic.QuicEndpoint}
* `config` {quic.EndpointOptions}

새로운 엔드포인트가 생성될 때 게시됩니다.

## 채널: `quic.endpoint.listen`

<!-- YAML
added: v23.8.0
-->

* `endpoint` {quic.QuicEndpoint}
* `options` {quic.SessionOptions}

endpoint가 들어오는 연결에 대해 듣는 경우 게시됩니다.

## 채널: `quic.endpoint.connect`

<!-- YAML
added: v26.2.0
-->

* `endpoint` {quic.QuicEndpoint}
* `address` {net.SocketAddress} The target server address.
* `options` {quic.SessionOptions}

[`quic.connect()`][]가 클라이언트 세션을 만드는 것에 대해 게시합니다.
ngtcp2 연결의 앞에 불은, 진단을 허용하
연결 의도를 관찰하는 가입자.

## 채널: `quic.endpoint.closing`

<!-- YAML
added: v23.8.0
-->

* `endpoint` {quic.QuicEndpoint}
* `hasPendingError` {boolean}

끝점이 우아하게 닫을 때 게시.

## 채널: `quic.endpoint.closed`

<!-- YAML
added: v23.8.0
-->

* `endpoint` {quic.QuicEndpoint}
* `stats` {quic.QuicEndpoint.Stats} Final endpoint statistics.

종료점이 종료되고 파괴되었을 때 게시됩니다.

## 채널: `quic.endpoint.error`

<!-- YAML
added: v23.8.0
-->

* `endpoint` {quic.QuicEndpoint}
* `error` {any}

endpoint가 닫히는 오류가 발생했을 때 게시됩니다.

## 채널: `quic.endpoint.busy.change`

<!-- YAML
added: v23.8.0
-->

* `endpoint` {quic.QuicEndpoint}
* `busy` {boolean}

endpoint의 바쁜 상태가 변경 될 때 게시.

## 채널: `quic.session.application`

<!-- YAML
added: v23.8.0
-->

* `applicationoptions` {quic.ApplicationOptions} Current application options.
* `session` {quic.QuicSession}

현지에서 시작된 스트림이 열릴 때 게시됩니다.

## 채널: `quic.session.created.client`

<!-- YAML
added: v23.8.0
-->

* `endpoint` {quic.QuicEndpoint}
* `session` {quic.QuicSession}
* `address` {net.SocketAddress} The remote server address.
* `options` {quic.SessionOptions}

클라이언트 개시 세션이 생성될 때 게시됩니다.

## 채널: `quic.session.created.server`

<!-- YAML
added: v23.8.0
-->

* `endpoint` {quic.QuicEndpoint}
* `session` {quic.QuicSession}
* `address` {net.SocketAddress|undefined} The remote peer address.

서버 측 세션이 들어오는 연결을 위해 작성된 경우.

## 채널: `quic.session.open.stream`

<!-- YAML
added: v23.8.0
-->

* `stream` {quic.QuicStream}
* `session` {quic.QuicSession}
* `direction` {string} Either `'bidi'` or `'uni'`.

현지에서 시작된 스트림이 열릴 때 게시됩니다.

## 채널: `quic.session.received.stream`

<!-- YAML
added: v23.8.0
-->

* `stream` {quic.QuicStream}
* `session` {quic.QuicSession}
* `direction` {string} Either `'bidi'` or `'uni'`.

원격으로 시작된 스트림이 수신될 때 게시됩니다.

## 채널: `quic.session.send.datagram`

<!-- YAML
added: v23.8.0
-->

* `id` {bigint} The datagram ID.
* `length` {number} The datagram payload size in bytes.
* `session` {quic.QuicSession}

데이터그램이 전송을 위해 할당 될 때 게시.

## 채널: `quic.session.update.key`

<!-- YAML
added: v23.8.0
-->

* `session` {quic.QuicSession}

TLS 키 업데이트가 시작될 때 게시됩니다.

## 채널: `quic.session.closing`

<!-- YAML
added: v23.8.0
-->

* `session` {quic.QuicSession}

세션이 우아하게 닫을 때 게시 (를 포함하여 경우
GOAWAY 프레임은 피어로부터 받았습니다.

## 채널: `quic.session.closed`

<!-- YAML
added: v23.8.0
-->

* `session` {quic.QuicSession}
* `error` {any} The error that caused the close, or `undefined` if clean.
* `stats` {quic.QuicSession.Stats} Final session statistics.

세션이 파괴 될 때 게시. `stats` 객체는 스냅샷입니다.
파괴의 시간에 최종 통계의.

## 채널: `quic.session.error`

<!-- YAML
added: v26.2.0
-->

* `session` {quic.QuicSession}
* `error` {any} The error that caused the session to be destroyed.

세션이 오류로 인해 파괴 될 때 게시. 화재 전
`onerror` 콜백과 스트림 이전은 찢어. 
`quic.session.closed`의 특징 (깨끗하고 오류가 닫히는 것은)
오류가 존재 할 때만 채널 화재, 그것을 위해 적합
오류 전용 경고.

## 채널: `quic.session.receive.datagram`

<!-- YAML
added: v23.8.0
-->

* `length` {number} The datagram payload size in bytes.
* `early` {boolean} Whether the datagram was received as 0-RTT early data.
* `session` {quic.QuicSession}

데이터그램이 원격 피어에서 수신될 때 게시됩니다.

## 채널: `quic.session.receive.datagram.status`

<!-- YAML
added: v23.8.0
-->

* `id` {bigint} The datagram ID.
* `status` {string} One of `'acknowledged'`, `'lost'`, or `'abandoned'`.
* `session` {quic.QuicSession}

전송된 datagram의 배달 상태를 업데이트할 때 게시됩니다.

## 채널: `quic.session.path.validation`

<!-- YAML
added: v23.8.0
-->

* `result` {string} One of `'success'`, `'failure'`, or `'aborted'`.
* `newLocalAddress` {net.SocketAddress}
* `newRemoteAddress` {net.SocketAddress}
* `oldLocalAddress` {net.SocketAddress|null}
* `oldRemoteAddress` {net.SocketAddress|null}
* `preferredAddress` {boolean}
* `session` {quic.QuicSession}

경로 검증 시도가 완료 될 때 게시.

## 채널: `quic.session.new.token`

<!-- YAML
added: v26.2.0
-->

* `token` {Buffer} The NEW\_TOKEN token data.
* `address` {net.SocketAddress} The remote server address.
* `session` {quic.QuicSession}

클라이언트 세션이 NEW\ TOKEN 프레임을 수신하면
서버.

## 채널: `quic.session.ticket`

<!-- YAML
added: v23.8.0
-->

* `ticket` {Object} The opaque session ticket.
* `session` {quic.QuicSession}

새로운 TLS 세션 티켓이 수신되면 게시됩니다.

## 채널: `quic.session.version.negotiation`

<!-- YAML
added: v23.8.0
-->

* `version` {number} The QUIC version that was configured for this session.
* `requestedVersions` {number\[]} The versions advertised by the server.
`supportedVersions` {number\[]} 로컬 버전 지원.
* `supportedVersions` {number\[]} The versions supported locally.

클라이언트가 버전 협상 패킷을받을 때 게시
서버. 세션은 항상 즉시 종료됩니다.

## 채널: `quic.session.receive.origin`

<!-- YAML
added: v26.2.0
-->

* `origins` {string\[]} The list of origins the server is authoritative for.
* `session` {quic.QuicSession}

세션이 ORIGIN 프레임 (RFC 9412)를 수신 할 때 게시

## 채널: `quic.session.handshake`

<!-- YAML
added: v23.8.0
-->

* `session` {quic.QuicSession}
* `servername` {string}
* `protocol` {string}
* `cipher` {string}
* `cipherVersion` {string}
* `validationErrorReason` {string}
* `validationErrorCode` {number}
* `earlyDataAttempted` {boolean}
* `earlyDataAccepted` {boolean}

TLS Handhake가 완료 될 때 게시.

## 채널: `quic.session.goaway`

<!-- YAML
added: v26.2.0
-->

* `session` {quic.QuicSession}
* `lastStreamId` {bigint} The highest stream ID the peer may have processed.

피어가 HTTP/3 GOAWAY 프레임을 보낼 때 게시됩니다. ID와 스트림
위의 `lastStreamId`는 처리되지 않았고 새로운에 기여할 수 있습니다.
연결. `lastStreamId` `-1n`의 `lastStreamId`는 폐쇄 통지를 나타냅니다
스트림 경계.

## 채널: `quic.session.early.rejected`

<!-- YAML
added: v26.2.0
-->

* `session` {quic.QuicSession}

서버가 0-RTT 초기 데이터를 거부할 때 게시됩니다. 모든 스트림은
0-RTT 단계가 파괴되었습니다. 진단을 위한 유용한
0-RTT가 성공할 것으로 예상되는 지연 회귀.

## 채널: `quic.stream.closed`

<!-- YAML
added: v26.2.0
-->

* `stream` {quic.QuicStream}
* `session` {quic.QuicSession}
* `error` {any} The error that caused the close, or `undefined` if clean.
* `stats` {quic.QuicStream.Stats} Final stream statistics.

스트림이 파괴 될 때 게시. `stats` 객체는 스냅샷입니다.
파괴의 시간에 최종 통계의.

## 채널: `quic.stream.headers`

<!-- YAML
added: v26.2.0
-->

* `stream` {quic.QuicStream}
* `session` {quic.QuicSession}
* `headers` {Object} The initial request or response headers.

처음 헤더가 스트림에 수신 될 때 게시. HTTP/3의 경우
서버 측 스트림, 이것은 요청 가짜 헤더 (`:method`,
`:path` 등 클라이언트 측 시내를 위해, 이것은 응답 headers를 포함합니다
(`:status` 등).

## 채널: `quic.stream.trailers`

<!-- YAML
added: v26.2.0
-->

* `stream` {quic.QuicStream}
* `session` {quic.QuicSession}
* `trailers` {Object} The trailing headers.

헤드러가 스트림에 수신 될 때 게시.

## 채널: `quic.stream.info`

<!-- YAML
added: v26.2.0
-->

* `stream` {quic.QuicStream}
* `session` {quic.QuicSession}
* `headers` {Object} The informational headers.

informational (1xx) 헤더가 스트림에 수신 될 때 게시
(예, 103 초기 힌트).

## 채널: `quic.stream.reset`

<!-- YAML
added: v26.2.0
-->

* `stream` {quic.QuicStream}
* `session` {quic.QuicSession}
* `error` {any} The QUIC error associated with the reset.

스트림이 STOP\ SENDING 또는 RESET\ STREAM 프레임을받을 때 게시 됨
피어를 나타내는 피어는 스트림을 낳았습니다. 이것은
diagnosing 신청을 위한 중요한 신호 취소와 같은 수준 문제점


## 채널: `quic.stream.blocked`

<!-- YAML
added: v26.2.0
-->

* `stream` {quic.QuicStream}
* `session` {quic.QuicSession}

스트림이 흐름 제어 차단되고 데이터를 보낼 때 게시
피어가 흐름 제어 창을 증가시킬 때까지. 진단을 위한 유용한
유량 제어에 의한 처리량 문제.

[Aborting a stream]: #aborting-a-stream
[Callback error handling]: #callback-error-handling
[JSON-SEQ]: https://www.rfc-editor.org/rfc/rfc7464
[NSS Key Log Format]: https://udn.realityripple.com/docs/Mozilla/Projects/NSS/Key_Log_Format
[Permission Model]: permissions.md#permission-model
[RFC 8879]: https://www.rfc-editor.org/rfc/rfc8879
[RFC 8999]: https://www.rfc-editor.org/rfc/rfc8999
[RFC 9000]: https://www.rfc-editor.org/rfc/rfc9000
[RFC 9000 Section 8.1]: https://www.rfc-editor.org/rfc/rfc9000#section-8.1
[RFC 9001]: https://www.rfc-editor.org/rfc/rfc9001
[RFC 9002]: https://www.rfc-editor.org/rfc/rfc9002
[RFC 9114]: https://www.rfc-editor.org/rfc/rfc9114
[RFC 9204]: https://www.rfc-editor.org/rfc/rfc9204
[RFC 9218]: https://www.rfc-editor.org/rfc/rfc9218
[RFC 9220]: https://www.rfc-editor.org/rfc/rfc9220
[RFC 9221]: https://www.rfc-editor.org/rfc/rfc9221
[RFC 9287]: https://www.rfc-editor.org/rfc/rfc9287
[RFC 9297]: https://www.rfc-editor.org/rfc/rfc9297
[RFC 9308]: https://www.rfc-editor.org/rfc/rfc9308
[RFC 9312]: https://www.rfc-editor.org/rfc/rfc9312
[RFC 9368]: https://www.rfc-editor.org/rfc/rfc9368
[RFC 9369]: https://www.rfc-editor.org/rfc/rfc9369
[RFC 9412]: https://www.rfc-editor.org/rfc/rfc9412
[RFC 9443]: https://www.rfc-editor.org/rfc/rfc9443
[`PerformanceEntry`]: perf_hooks.md#class-performanceentry
[`PerformanceObserver`]: perf_hooks.md#class-performanceobserver
[`QuicEndpoint`]: #class-quicendpoint
[`QuicError`]: #class-quicerror
[`application.enableConnectProtocol`]: #sessionoptionsapplication
[`application.enableDatagrams`]: #sessionoptionsapplication
[`application.qpackMaxDTableCapacity`]: #sessionoptionsapplication
[`crypto.X509Certificate`]: crypto.md#class-x509certificate
[`endpoint.busy`]: #endpointbusy
[`endpoint.maxConnectionsPerHost`]: #endpointmaxconnectionsperhost
[`endpoint.maxConnectionsTotal`]: #endpointmaxconnectionstotal
[`endpointOptions.blockListPolicy`]: #endpointoptionsblocklistpolicy
[`endpointOptions.blockList`]: #endpointoptionsblocklist
[`endpointOptions.immediateCloseBurst`]: #endpointoptionsimmediatecloseburst
[`endpointOptions.immediateCloseRate`]: #endpointoptionsimmediatecloserate
[`endpointOptions.retryBurst`]: #endpointoptionsretryburst
[`endpointOptions.retryRate`]: #endpointoptionsretryrate
[`endpointOptions.sessionCreationBurst`]: #endpointoptionssessioncreationburst
[`endpointOptions.sessionCreationRate`]: #endpointoptionssessioncreationrate
[`endpointOptions.statelessResetBurst`]: #endpointoptionsstatelessresetburst
[`endpointOptions.statelessResetRate`]: #endpointoptionsstatelessresetrate
[`endpointOptions.versionNegotiationBurst`]: #endpointoptionsversionnegotiationburst
[`endpointOptions.versionNegotiationRate`]: #endpointoptionsversionnegotiationrate
[`error.errorCode`]: #errorerrorcode
[`fs.promises.open(path, 'r')`]: fs.md#fspromisesopenpath-flags-mode
[`maxDatagramFrameSize`]: #transportparamsmaxdatagramframesize
[`net.BlockList`]: net.md#class-netblocklist
[`quic.connect()`]: #quicconnectaddress-options
[`quic.listen()`]: #quiclistenonsession-options
[`session.close()`]: #sessioncloseoptions
[`session.createBidirectionalStream()`]: #sessioncreatebidirectionalstreamoptions
[`session.createUnidirectionalStream()`]: #sessioncreateunidirectionalstreamoptions
[`session.destroy()`]: #sessiondestroyerror-options
[`session.maxPendingDatagrams`]: #sessionmaxpendingdatagrams
[`session.onapplication`]: #sessiononapplication
[`session.ondatagram`]: #sessionondatagram
[`session.ondatagramstatus`]: #sessionondatagramstatus
[`session.onearlyrejected`]: #sessiononearlyrejected
[`session.onerror`]: #sessiononerror
[`session.ongoaway`]: #sessionongoaway
[`session.onkeylog`]: #sessiononkeylog
[`session.onnewtoken`]: #sessiononnewtoken
[`session.onorigin`]: #sessiononorigin
[`session.onqlog`]: #sessiononqlog
[`session.onsessionticket`]: #sessiononsessionticket
[`session.onstream`]: #sessiononstream
[`session.sendDatagram()`]: #sessionsenddatagramdatagram-encoding
[`sessionOptions.cc`]: #sessionoptionscc
[`sessionOptions.ciphers`]: #sessionoptionsciphers
[`sessionOptions.datagramDropPolicy`]: #sessionoptionsdatagramdroppolicy
[`sessionOptions.groups`]: #sessionoptionsgroups
[`sessionOptions.keylog`]: #sessionoptionskeylog
[`sessionOptions.qlog`]: #sessionoptionsqlog
[`sessionOptions.sessionTicket`]: #sessionoptionssessionticket
[`sessionOptions.sni`]: #sessionoptionssni-server-only
[`sessionOptions.token`]: #sessionoptionstoken-client-only
[`stream.destroy()`]: #streamdestroyerror-options
[`stream.headers`]: #streamheaders
[`stream.onerror`]: #streamonerror
[`stream.onwanttrailers`]: #streamonwanttrailers
[`stream.pendingTrailers`]: #streampendingtrailers
[`stream.priority`]: #streampriority
[`stream.sendHeaders()`]: #streamsendheadersheaders-options
[`stream.sendInformationalHeaders()`]: #streamsendinformationalheadersheaders
[`stream.sendTrailers()`]: #streamsendtrailersheaders
[`stream.setBody()`]: #streamsetbodybody
[`stream.setPriority()`]: #streamsetpriorityoptions
[`stream.writer`]: #streamwriter
[`writer.fail()`]: #streamwriter
[`writer.fail(reason)`]: #streamwriter
[qlog]: https://datatracker.ietf.org/doc/draft-ietf-quic-qlog-main-schema/
[qvis]: https://qvis.quictools.info/
