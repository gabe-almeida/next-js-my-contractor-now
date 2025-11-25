# System Architecture Diagrams
## Lead Buyer Geographic Mapping System

## C4 Model Architecture Diagrams

### Level 1: System Context Diagram

```mermaid
graph TB
    %% External Actors
    Consumer[Lead Consumer<br/>Home Owner]
    Admin[System Administrator]
    Buyer[Lead Buyer<br/>Contractor]
    
    %% Main System
    Platform[My Contractor Now<br/>Lead Generation Platform]
    
    %% External Systems
    TrustedForm[TrustedForm<br/>Compliance Service]
    Jornaya[Jornaya<br/>Lead Intelligence]
    Payment[Payment Gateway]
    
    %% Relationships
    Consumer --> Platform : "Submits service requests"
    Admin --> Platform : "Manages buyers & coverage"
    Platform --> Buyer : "Sends leads via API"
    Buyer --> Platform : "Responds with bids"
    
    Platform --> TrustedForm : "Generates compliance certificates"
    Platform --> Jornaya : "Captures lead intelligence"
    Platform --> Payment : "Processes payments"
    
    classDef system fill:#326ce5,color:#fff
    classDef external fill:#ff9900,color:#fff
    classDef person fill:#08427b,color:#fff
    
    class Platform system
    class TrustedForm,Jornaya,Payment external
    class Consumer,Admin,Buyer person
```

### Level 2: Container Diagram

```mermaid
graph TB
    %% External Actors
    Consumer[Lead Consumer]
    Admin[Admin User]
    Buyer[Lead Buyer]
    
    %% Web Application
    WebApp[Web Application<br/>Next.js Frontend<br/><br/>Lead forms, Admin dashboard]
    
    %% API Application  
    API[API Application<br/>Next.js API Routes<br/><br/>Lead processing, Auction engine]
    
    %% Database
    DB[(Database<br/>SQLite/Prisma<br/><br/>Leads, Buyers, Geographic mapping)]
    
    %% Background Services
    Queue[Background Workers<br/>Node.js<br/><br/>Lead processing, Auction execution]
    
    %% External Systems
    TrustedForm[TrustedForm API]
    Jornaya[Jornaya API]
    BuyerAPIs[Buyer APIs<br/>Various contractors]
    
    %% Relationships
    Consumer --> WebApp : "Submits forms"
    Admin --> WebApp : "Manages system"
    Buyer --> BuyerAPIs : "Receives leads"
    
    WebApp --> API : "HTTPS/REST"
    API --> DB : "SQL queries"
    API --> Queue : "Job scheduling"
    Queue --> DB : "Data updates"
    
    API --> TrustedForm : "HTTPS/REST"
    API --> Jornaya : "HTTPS/REST"
    Queue --> BuyerAPIs : "HTTPS/REST"
    
    classDef container fill:#326ce5,color:#fff
    classDef database fill:#ff9900,color:#fff
    classDef external fill:#999999,color:#fff
    classDef person fill:#08427b,color:#fff
    
    class WebApp,API,Queue container
    class DB database
    class TrustedForm,Jornaya,BuyerAPIs external
    class Consumer,Admin,Buyer person
```

### Level 3: Component Diagram - Auction Engine

```mermaid
graph TB
    subgraph "Auction Engine System"
        %% Core Components
        AuctionController[Auction Controller<br/>Orchestrates auction flow]
        EligibilityEngine[Eligibility Engine<br/>Filters buyers by geography]
        BiddingEngine[Bidding Engine<br/>Manages PING/POST cycle]
        WinnerSelector[Winner Selection<br/>Applies auction logic]
        
        %% Geographic Components  
        GeoResolver[Geographic Resolver<br/>ZIP code validation]
        CoverageValidator[Coverage Validator<br/>Service area checking]
        
        %% Data Access Layer
        BuyerRepository[Buyer Repository<br/>Buyer data access]
        GeographicRepository[Geographic Repository<br/>ZIP/Service mapping]
        
        %% External Interfaces
        TemplateEngine[Template Engine<br/>PING/POST formatting]
        APIConnector[API Connector<br/>Buyer communication]
    end
    
    %% Database Tables
    subgraph "Database Schema"
        BuyerTable[(buyers)]
        ServiceTypeTable[(service_types)]
        ZipCodeTable[(zip_codes)]
        BuyerServiceZipTable[(buyer_service_zip_codes)]
        ServiceTypeZipTable[(service_type_zip_codes)]
        LeadTable[(leads)]
    end
    
    %% Flow
    AuctionController --> EligibilityEngine
    EligibilityEngine --> GeoResolver
    EligibilityEngine --> CoverageValidator
    EligibilityEngine --> BuyerRepository
    EligibilityEngine --> GeographicRepository
    
    AuctionController --> BiddingEngine
    BiddingEngine --> TemplateEngine
    BiddingEngine --> APIConnector
    
    AuctionController --> WinnerSelector
    
    %% Data Access
    BuyerRepository --> BuyerTable
    BuyerRepository --> ServiceTypeTable
    GeographicRepository --> ZipCodeTable
    GeographicRepository --> BuyerServiceZipTable
    GeographicRepository --> ServiceTypeZipTable
    GeographicRepository --> LeadTable
    
    classDef component fill:#326ce5,color:#fff
    classDef database fill:#ff9900,color:#fff
    
    class AuctionController,EligibilityEngine,BiddingEngine,WinnerSelector component
    class GeoResolver,CoverageValidator,BuyerRepository,GeographicRepository component  
    class TemplateEngine,APIConnector component
    class BuyerTable,ServiceTypeTable,ZipCodeTable database
    class BuyerServiceZipTable,ServiceTypeZipTable,LeadTable database
```

### Level 4: Code Diagram - Geographic Mapping

```mermaid
classDiagram
    class ZipCode {
        +String code PK
        +String stateCode
        +String county
        +String city
        +Decimal latitude
        +Decimal longitude
        +Boolean active
        +DateTime createdAt
        +DateTime updatedAt
    }
    
    class ServiceType {
        +String id PK
        +String name
        +String displayName
        +String formSchema
        +Boolean active
        +DateTime createdAt
        +DateTime updatedAt
    }
    
    class Buyer {
        +String id PK
        +String name
        +String apiUrl
        +String authConfig
        +Integer pingTimeout
        +Integer postTimeout
        +Boolean active
        +DateTime createdAt
        +DateTime updatedAt
    }
    
    class ServiceTypeZipCode {
        +String id PK
        +String serviceTypeId FK
        +String zipCode FK
        +Boolean active
        +Integer priority
        +DateTime createdAt
        +DateTime updatedAt
    }
    
    class BuyerServiceZipCode {
        +String id PK
        +String buyerId FK
        +String serviceTypeId FK
        +String zipCode FK
        +Decimal minBid
        +Decimal maxBid
        +Integer priority
        +Boolean active
        +DateTime createdAt
        +DateTime updatedAt
    }
    
    class Lead {
        +String id PK
        +String serviceTypeId FK
        +String zipCode FK
        +String formData
        +Boolean ownsHome
        +String timeframe
        +String status
        +String winningBuyerId FK
        +Decimal winningBid
        +DateTime createdAt
        +DateTime updatedAt
    }
    
    %% Relationships
    ServiceType ||--o{ ServiceTypeZipCode : "serves ZIP codes"
    ZipCode ||--o{ ServiceTypeZipCode : "served by services"
    
    Buyer ||--o{ BuyerServiceZipCode : "covers areas"
    ServiceType ||--o{ BuyerServiceZipCode : "for service"
    ZipCode ||--o{ BuyerServiceZipCode : "covered by buyers"
    
    ServiceType ||--o{ Lead : "requested service"
    ZipCode ||--o{ Lead : "lead location"
    Buyer ||--o{ Lead : "winning buyer"
```

## Data Flow Diagrams

### Auction Process Flow

```mermaid
sequenceDiagram
    participant L as Lead
    participant AE as Auction Engine
    participant GR as Geographic Resolver
    participant BR as Buyer Repository
    participant BC as Buyer APIs
    participant DB as Database
    
    L->>AE: New lead submitted
    AE->>GR: Validate ZIP code
    GR->>DB: Check ZIP code exists
    DB-->>GR: ZIP code valid
    
    AE->>GR: Get service coverage
    GR->>DB: Query service_type_zip_codes
    DB-->>GR: Service available in ZIP
    
    AE->>BR: Get eligible buyers
    BR->>DB: Query buyer_service_zip_codes
    DB-->>BR: Eligible buyer list
    
    loop For each eligible buyer
        AE->>BC: Send PING request
        BC-->>AE: Bid response
    end
    
    AE->>AE: Select winning bid
    AE->>BC: Send POST to winner
    BC-->>AE: Acceptance response
    
    AE->>DB: Update lead with winner
    AE->>L: Auction complete
```

### Geographic Coverage Management

```mermaid
flowchart TD
    A[Admin Interface] --> B{Operation Type}
    
    B -->|Add Coverage| C[Select Service Type]
    B -->|Remove Coverage| D[Select Existing Coverage]
    B -->|Bulk Import| E[Upload ZIP List]
    
    C --> F[Select ZIP Codes]
    F --> G[Set Priority Level]
    G --> H[Validate Coverage]
    H --> I[Create ServiceTypeZipCode]
    
    D --> J[Confirm Removal]
    J --> K[Soft Delete Record]
    
    E --> L[Parse ZIP Codes]
    L --> M[Validate ZIP Format]
    M --> N[Batch Insert Records]
    
    I --> O[(Database)]
    K --> O
    N --> O
    
    O --> P[Update Coverage Cache]
    P --> Q[Notify Auction Engine]
```

## Technology Stack Architecture

### Infrastructure Layers

```mermaid
graph TB
    subgraph "Presentation Layer"
        React[React Components]
        NextJS[Next.js Framework]
        TailwindCSS[Tailwind CSS]
    end
    
    subgraph "API Layer"
        APIRoutes[Next.js API Routes]
        Middleware[Custom Middleware]
        Validation[Data Validation]
    end
    
    subgraph "Business Logic Layer"
        AuctionEngine[Auction Engine]
        FormEngine[Dynamic Form Engine]
        TemplateEngine[Template Engine]
        ComplianceEngine[Compliance Engine]
    end
    
    subgraph "Data Access Layer"
        Prisma[Prisma ORM]
        DatabaseQueries[Optimized Queries]
        Migrations[Schema Migrations]
    end
    
    subgraph "Infrastructure Layer"
        SQLite[(SQLite Database)]
        FileSystem[File Storage]
        Redis[Redis Cache]
        BackgroundJobs[Background Workers]
    end
    
    subgraph "External Services"
        TrustedFormAPI[TrustedForm API]
        JornayaAPI[Jornaya API]
        BuyerAPIs[Buyer APIs]
    end
    
    React --> NextJS
    NextJS --> APIRoutes
    APIRoutes --> Middleware
    Middleware --> Validation
    
    APIRoutes --> AuctionEngine
    APIRoutes --> FormEngine
    APIRoutes --> TemplateEngine
    APIRoutes --> ComplianceEngine
    
    AuctionEngine --> Prisma
    FormEngine --> Prisma
    TemplateEngine --> Prisma
    ComplianceEngine --> Prisma
    
    Prisma --> DatabaseQueries
    DatabaseQueries --> SQLite
    Prisma --> Migrations
    
    AuctionEngine --> Redis
    BackgroundJobs --> Redis
    BackgroundJobs --> SQLite
    
    ComplianceEngine --> TrustedFormAPI
    ComplianceEngine --> JornayaAPI
    AuctionEngine --> BuyerAPIs
    
    classDef presentation fill:#e1f5fe
    classDef api fill:#f3e5f5
    classDef business fill:#fff8e1
    classDef data fill:#e8f5e8
    classDef infrastructure fill:#fce4ec
    classDef external fill:#f5f5f5
    
    class React,NextJS,TailwindCSS presentation
    class APIRoutes,Middleware,Validation api
    class AuctionEngine,FormEngine,TemplateEngine,ComplianceEngine business
    class Prisma,DatabaseQueries,Migrations data
    class SQLite,FileSystem,Redis,BackgroundJobs infrastructure
    class TrustedFormAPI,JornayaAPI,BuyerAPIs external
```

## Deployment Architecture

### Production Environment

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[NGINX Load Balancer]
    end
    
    subgraph "Application Servers"
        App1[Next.js App Server 1]
        App2[Next.js App Server 2]
        App3[Next.js App Server 3]
    end
    
    subgraph "Database Cluster"
        Primary[(Primary Database)]
        Replica1[(Read Replica 1)]
        Replica2[(Read Replica 2)]
    end
    
    subgraph "Cache Layer"
        Redis1[Redis Master]
        Redis2[Redis Replica]
    end
    
    subgraph "Background Services"
        Queue1[Worker Queue 1]
        Queue2[Worker Queue 2]
    end
    
    subgraph "Monitoring & Logging"
        Monitor[Monitoring Service]
        Logs[Log Aggregation]
    end
    
    LB --> App1
    LB --> App2  
    LB --> App3
    
    App1 --> Primary
    App1 --> Replica1
    App2 --> Primary
    App2 --> Replica2
    App3 --> Primary
    App3 --> Replica1
    
    App1 --> Redis1
    App2 --> Redis1
    App3 --> Redis1
    Redis1 --> Redis2
    
    App1 --> Queue1
    App2 --> Queue2
    Queue1 --> Primary
    Queue2 --> Primary
    
    App1 --> Monitor
    App2 --> Monitor
    App3 --> Monitor
    Queue1 --> Logs
    Queue2 --> Logs
    
    classDef server fill:#326ce5,color:#fff
    classDef database fill:#ff9900,color:#fff
    classDef cache fill:#4caf50,color:#fff
    classDef service fill:#9c27b0,color:#fff
    
    class LB,App1,App2,App3 server
    class Primary,Replica1,Replica2 database
    class Redis1,Redis2 cache
    class Queue1,Queue2,Monitor,Logs service
```

## Quality Attributes & Non-Functional Requirements

### Performance Architecture

- **Response Time**: < 200ms for auction eligibility queries
- **Throughput**: Support 1,000+ concurrent auctions
- **Scalability**: Horizontal scaling of app servers
- **Caching**: Multi-level caching strategy (Redis, application, database)

### Security Architecture

- **Authentication**: JWT-based session management
- **Authorization**: Role-based access control (RBAC)
- **Data Encryption**: Encryption at rest and in transit
- **API Security**: Rate limiting, input validation, CORS policies

### Reliability Architecture

- **High Availability**: 99.9% uptime target
- **Fault Tolerance**: Graceful degradation for external API failures
- **Backup Strategy**: Daily automated backups with point-in-time recovery
- **Monitoring**: Comprehensive application and infrastructure monitoring

### Maintainability Architecture

- **Code Organization**: Modular component architecture
- **Documentation**: Comprehensive API and system documentation
- **Testing**: Unit, integration, and end-to-end test coverage
- **Deployment**: Automated CI/CD pipeline with rollback capabilities

This architecture provides a scalable, maintainable foundation for the lead buyer geographic mapping system while supporting efficient auction processing and flexible business requirements.