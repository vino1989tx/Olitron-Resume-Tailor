export interface ResumeProject {
  id: string;
  clientLabel: string;
  duration: string;
  bullets: string[];
}

export interface ResumeJob {
  role: string;
  company: string;
  duration: string;
  clientsLine: string;
  projects: ResumeProject[];
}

export interface ResumeData {
  name: string;
  title: string;
  phone: string;
  email: string;
  location: string;
  linkedin: string;
  // Extra free-text contact lines under the left (phone/email) and right
  // (linkedin/location) halves of the header.
  leftExtras: string[];
  rightExtras: string[];
  summary: string[];
  skills: Array<{ label: string; items: string }>;
  experience: ResumeJob[];
  education: string;
}

// Ensure a resume has the extra-line arrays (older saved resumes / AI responses
// may not include them).
export function withHeaderExtras(data: ResumeData): ResumeData {
  return {
    ...data,
    leftExtras: Array.isArray(data.leftExtras) ? data.leftExtras : [],
    rightExtras: Array.isArray(data.rightExtras) ? data.rightExtras : [],
  };
}

// Blank resume used as the default state. The app opens empty and only fills
// in once the user uploads a resume or opens a previously saved one.
export const emptyResumeData: ResumeData = {
  name: '',
  title: '',
  phone: '',
  email: '',
  location: '',
  linkedin: '',
  leftExtras: [],
  rightExtras: [],
  summary: [],
  skills: [],
  experience: [],
  education: '',
};

// Structured base resume content extracted from the latest source PDF.
export const initialResumeData: ResumeData = {
  name: "Vinoth Radhakrishnan",
  title: "Technology Lead| Senior Full Stack Engineer",
  phone: "+1 (754) 364-8308",
  email: "vino1989tx@gmail.com",
  location: "Texas- USA",
  linkedin: "linkedin.com/in/vinoth-radhakrishnan89",
  leftExtras: [],
  rightExtras: [],

  summary: [
    "Technology Lead and Full-Stack Engineer with 15+ years of experience designing and delivering enterprise-scale web applications, Single Page Applications (SPAs), and digital platforms across Airlines, Hospitality, Telecom, Banking, and Income Tax domains.",
    "Extensive experience building modern front-end applications using Angular, React, Vue.js, TypeScript, JavaScript (ES6+), HTML5, CSS3/SCSS, Bootstrap, Tailwind CSS, and responsive UI frameworks.",
    "Strong expertise in architecting scalable backend solutions using .NET Core, ASP.NET Core, C#, Scala Microservices, REST APIs, GraphQL, and distributed system architectures.",
    "Hands-on experience with Adobe Experience Manager (AEM), Adobe Experience Platform (AEP), Adobe Target, and enterprise CMS solutions including Drupal and Ektron.",
    "Proven track record of developing cloud-native applications leveraging Microsoft Azure services including Azure App Services, Azure Functions, Azure Storage, Azure DevOps, and event-driven architectures.",
    "Experienced in implementing Microservices Architecture, API integrations, OAuth 2.0, JWT Authentication, Role-Based Access Control (RBAC), and enterprise security best practices.",
    "Strong knowledge of RxJS, NgRx, Redux, Reactive Programming, State Management, and performance optimization for large-scale Angular and Vue.js applications",
    "Skilled in designing reusable UI component libraries, design systems, and translating Figma designs into pixel-perfect, responsive, and accessible user experiences aligned with WCAG standards.",
    "Experience building AI-enabled applications and leveraging GitHub Copilot, ChatGPT, Claude AI, and OpenAI APIs to accelerate software development, automate coding tasks, and generate documentation.",
    "Strong database experience with SQL Server, Oracle, MySQL, NoSQL databases, stored procedures, query optimization, indexing, caching strategies, and performance tuning.",
    "Proven leadership experience in Agile Scrum/Kanban environments, including solution design, architecture reviews, code reviews, mentoring developers, sprint planning, stakeholder collaboration, and end-to-end SDLC ownership.",
    "Full SDLC ownership: requirements, design, development, testing, deployment, and maintenance.",
    "Excellent communication and problem-solving skills with a strong focus on scalability, maintainability, quality engineering, and delivering high-performance enterprise solutions.",
  ],

  skills: [
    {
      label: "Frontend",
      items: "Angular (V2–V20), React.js, Vue.js, Next.js, TypeScript, JavaScript (ES6+), HTML5, CSS3, SCSS, Bootstrap, Angular Material, RxJS, NgRx, Redux Toolkit, React Hooks, Micro Frontends, Soy Templates",
    },
    {
      label: "Backend & APIs",
      items: ".NET C#, ASP.NET Core, .NET Core, Scala Microservices, REST APIs, GraphQL, Node.js, OAuth 2.0, JWT, RBAC, Sling Models",
    },
    {
      label: "Adobe & CMS",
      items: "AEM (Adobe Experience Manager), AEP (Adobe Experience Platform), Adobe Target, Ektron",
    },
    {
      label: "Databases",
      items: "SQL Server, MySQL, Oracle, Query Optimization, Performance Tuning",
    },
    {
      label: "Cloud & DevOps",
      items: "Microsoft Azure (App Services, Functions, Storage, Azure DevOps), AWS S3, Jenkins, GitHub Actions, CI/CD Pipelines, Git, Bitbucket, NPM, Docker, Chrome DevTools, Jira, Elastic Search",
    },
    {
      label: "AI & Automation",
      items: "GitHub Copilot, ChatGPT, Claude AI, OpenAI API, Azure, AI Chatbots, Prompt Engineering",
    },
    {
      label: "Testing & Tools",
      items: "Cypress, Jasmine, Karma, Jest, React Testing Library, Visual Studio, VS Code, Chrome DevTools",
    },
  ],

  experience: [
    {
      role: "Technology Lead - Full Stack Web Developer",
      company: "Info Services",
      duration: "Nov 2022 – Present",
      clientsLine: "Clients: Norwegian Cruise Line -Miami / United Airlines - Houston",
      projects: [
        {
          id: "united-airlines",
          clientLabel: "United Airlines",
          duration: "Nov 2025 - Present",
          bullets: [
            "Served as the Technical Lead and Angular/.NET Subject Matter Expert (SME), driving architecture, technical strategy, solution design, and end-to-end delivery of enterprise-scale applications while mentoring development teams and establishing engineering best practices.",
            "Led the design and development of scalable, high-performance Single Page Applications (SPAs) using Angular, TypeScript, RxJS, JavaScript, HTML5, SCSS, Bootstrap, Kendo UI, and ASP.NET MVC, delivering reusable, responsive, and maintainable enterprise solutions.",
            "Defined Angular architecture standards by implementing reusable component libraries, shared modules, standalone components, reactive forms, dependency injection, routing, lazy loading, route guards, interceptors, custom directives, custom pipes, and enterprise design patterns.",
            "Drove Angular modernization initiatives, framework upgrades, code refactoring, performance optimization, and application standardization using OnPush Change Detection, trackBy, code splitting, tree shaking, AOT compilation, bundle optimization, and RxJS best practices.",
            "Led the integration of Angular applications with RESTful APIs developed using C#, ASP.NET Web API, and .NET, implementing secure authentication, authorization, JWT/session management, centralized exception handling, middleware, logging, and asynchronous communication.",
            "Designed and developed enterprise-grade backend solutions using C#, ASP.NET MVC, ASP.NET Web API, LINQ, Entity Framework, dependency injection, async/await, repository patterns, and layered architecture supporting mission-critical business applications.",
            "Architected and optimized RESTful APIs, JSON-based integrations, business services, middleware components, and third-party system integrations to deliver secure, scalable, and high-performing distributed applications.",
            "Designed and optimized SQL Server databases by developing tables, indexes, stored procedures, views, functions, triggers, schema migrations, performance tuning, and multi-tenant database solutions supporting high-volume transactional systems.",
            "Led database design, schema management, deployment scripting, Entity Framework implementations, LINQ optimization, and ETL processes involving CSV, XML, and JSON data transformation into SQL Server environments. Provided technical leadership for Azure DevOps CI/CD pipelines, Git branching strategies, automated build and release pipelines, deployment automation, Azure App Services, Application Insights, log monitoring, diagnostics, and production support.",
            "Worked extensively with Azure and AWS cloud platforms to architect, deploy, monitor, and support Angular and .NET enterprise applications while ensuring scalability, availability, reliability, and operational excellence. Established coding standards, performed architecture reviews, conducted code reviews, enforced best practices, resolved complex production issues, optimized application performance, and drove continuous improvement initiatives across multiple Agile teams.",
            "Collaborated closely with Product Owners, Business Analysts, UX designers, QA engineers, DevOps teams, and stakeholders to translate business requirements into scalable technical solutions while providing technical guidance throughout the Software Development Life Cycle (SDLC).",
            "Mentored and coached developers on Angular architecture, RxJS, TypeScript, .NET, REST API development, SQL Server optimization, secure coding practices, and enterprise application development, improving overall engineering quality and team productivity.",
            "Led Agile/Scrum ceremonies including sprint planning, backlog refinement, story estimation, architecture discussions, technical design reviews, production deployments, release planning, and post-production support while ensuring on-time project delivery.",
            "Delivered enterprise full-stack solutions with deep expertise in Angular front-end development, .NET middleware, REST API development, SQL Server, Entity Framework, Azure DevOps, Azure, AWS, CI/CD, and cloud-native architectures, serving as the primary technical leader for mission-critical enterprise applications.",
          ],
        },
        {
          id: "norwegian-cruise-line",
          clientLabel: "Norwegian Cruise Line-Miami",
          duration: "Nov-2022 - Nov 2025",
          bullets: [
            "Designed and implemented cloud-ready Single Page Applications (SPAs) using Angular and React, delivering responsive, accessible, and localized user experiences.",
            "Developed scalable, secure, and high-performance RESTful APIs using C#, ASP.NET Core, and .NET Core, supporting cruise booking, dining, shore excursions, payments, and guest services.",
            "Built reusable frontend components and design-system libraries, including reusable Vue.js and Angular components, translating Figma designs into responsive, accessible, and pixel-perfect user interfaces.",
            "Architected and integrated distributed systems using .NET Core APIs, Scala microservices, REST APIs, and GraphQL services, improving scalability and maintainability across enterprise applications.",
            "Designed and consumed REST services to support real-time cruise availability, pricing, booking, and guest management functionalities.",
            "Developed and deployed cloud-native applications leveraging Microsoft Azure App Services, Azure Functions, Azure Storage, and event-driven integrations, ensuring high availability and reliability.",
            "Implemented containerized microservices using Docker and Kubernetes, enabling streamlined deployment, orchestration, scaling, and environment consistency.",
            "Applied reactive programming principles using RxJS and NgRx for state management, asynchronous workflows, and resilient front-end architectures.",
            "Designed and implemented secure authentication and authorization mechanisms using OAuth 2.0, JWT, and role-based access controls, ensuring secure communication between applications and services.",
            "Built and optimized backend services using SQL Server, stored procedures, indexing, caching strategies, and asynchronous processing, significantly improving API performance and database efficiency.",
            "Automated build, test, and deployment processes through Azure DevOps, Jenkins, GitHub Actions, and CI/CD pipelines, reducing deployment time and improving release quality.",
            "Implemented comprehensive testing strategies using Cypress, unit testing, and integration testing, ensuring application reliability and reducing production defects.",
            "Worked extensively with Git, Visual Studio, Azure DevOps, GitHub, Copilot, and ChatGPT, maintaining code quality through peer reviews and modern development practices.",
            "Integrated enterprise CMS platforms including Drupal and Ektron, enabling multilingual content management and empowering business teams with dynamic content publishing capabilities.",
            "Collaborated closely with Product Owners, UX/UI Designers, QA teams, DevOps engineers, and business stakeholders to deliver end-to-end enterprise solutions.",
            "Participated in architecture discussions, technical design reviews, sprint planning, code reviews, and production support activities for mission-critical applications.",
            "Mentored junior and mid-level developers, providing technical guidance, conducting knowledge-sharing sessions, and promoting engineering best practices.",
            "Applied frontend security best practices including XSS prevention, CSRF protection, secure API communication, and secure coding standards across enterprise applications.",
            "Leveraged cloud and distributed architecture concepts including load balancing, microservices, event-driven systems, Azure services, Docker, and Kubernetes to support large-scale user operations.",
          ],
        },
      ],
    },
    {
      role: "Technology Lead - Web Developer",
      company: "Infosys",
      duration: "Feb 2018 – Nov 2022",
      clientsLine: "Clients: Telenet (Belgium), Verizon, Income Tax Department, India",
      projects: [
        {
          id: "infosys-telecom",
          clientLabel: "Telenet / Verizon",
          duration: "Feb 2018 – Nov 2022",
          bullets: [
            "Developed front end using Angular5 integrated with Adobe Experience Platform (AEP) and API web services.",
            "Developed scalable, secure, and high-performance RESTful APIs using C#, ASP.NET Core, and .NET Core, supporting cart booking, payments, and other services.",
            "Architected and integrated distributed systems using .NET Core APIs, Scala microservices, REST APIs, and GraphQL services, improving scalability and maintainability across enterprise applications.",
            "Developed and deployed cloud-native applications leveraging Microsoft Azure App Services, Azure Functions, Azure Storage, and event-driven integrations, ensuring high availability and reliability.",
            "Created AEP schemas, datasets, data flows, profiles, and segments; integrated with Adobe Target for personalized experiences.",
            "Designed and developed Angular UI components, navigation menus, and SPAs using Angular-Router, TypeScript, and Bootstrap.",
            "Built reusable components with Angular, JavaScript, HTML5, CSS3, and JSON to enhance UI consistency.",
            "Utilized RxJS Observables, NgRx (Redux), and Promises for state management and asynchronous operations.",
            "Implemented JWT authentication, tokenizer, and validation frameworks to prevent XSS and CSRF attacks.",
            "Refactored and optimized legacy code with modern syntax (async/await), minification, and performance improvements.",
            "Integrated applications with multiple data sources including AWS S3, AEM, Oracle, and Adobe I/O APIs.",
            "Automated builds and deployments using Jenkins; versioned code with GitHub and Git Bash.",
            "Applied unit testing with Jasmine/Karma and debugging using Chrome DevTools for long-running SPAs.",
            "Developed React components alongside Angular modules to enhance hybrid UI development.",
            "Collaborated in Agile sprints using JIRA & Slack, actively participating in daily scrums and defect discussions.",
            "Implemented cross-browser compatibility and WCAG accessibility compliance for inclusive user experiences.",
            "Worked with NoSQL databases for high-performance operations and dynamic data handling.",
            "Triggered deployment pipelines for custom application images in the cloud using Jenkins.",
            "Service Ordering: Allowed customers to browse and select from a range of phone options based on their needs and preferences.",
            "Payment Processing: Facilitated secure payment transactions through integrated payment gateways, ensuring customer convenience and data security.",
            "Order Submission: Enabled customers to submit their service orders efficiently, with options to track order status and receive updates throughout the process.",
          ],
        },
        {
          id: "infosys-income-tax",
          clientLabel: "Income Tax Department, India",
          duration: "Feb 2018 – Nov 2022",
          bullets: [
            "Successfully managed a team of developers, providing guidance and oversight to ensure adherence to project timelines and quality standards.",
            "Designed and developed modules for the Income Tax e-filing system with Angular and Angular Material to build dynamic, user-friendly interfaces.",
            "Implemented reusable components (forms, dialogs, data tables, date pickers) using Angular Material for consistent UI/UX.",
            "Integrated REST APIs for taxpayer data validation, submissions, and acknowledgment receipts.",
            "Collaborated with cross-functional teams to ensure accessibility, scalability, and performance compliance with ITD standards.",
            "Wrote and executed unit tests using Jest and Jasmine to ensure application stability.",
          ],
        },
      ],
    },
    {
      role: "UI Developer / Software Engineer",
      company: "Tata Consultancy Services",
      duration: "Jan 2015 – Feb 2018",
      clientsLine: "Clients: T-Mobile, Sterling Holidays",
      projects: [
        {
          id: "tcs",
          clientLabel: "T-Mobile / Sterling Holidays",
          duration: "Jan 2015 – Feb 2018",
          bullets: [
            "Developed Adobe Experience Manager (AEM) components, sites, and managed DAM assets.",
            "Published and authored AEM components in live environments with Sling models to access authored values.",
            "Built front-end Angular components using TypeScript, HTML, CSS/SCSS, Bootstrap, and JavaScript.",
            "Integrated REST APIs and developed consumer-facing features with Angular2, JSON, and AJAX.",
            "Created responsive web pages ensuring cross-browser compatibility and modern UI best practices.",
            "Implemented and tested applications using Jasmine, Karma, and JUnit for Sling models.",
            "Applied Angular best practices for structured, maintainable, and scalable code.",
            "Used Eclipse IDE and Bitbucket for development and version control.",
            "Automated build and deployment processes with Jenkins.",
            "Involved in packaging, deployment, and upgrades of application modules.",
          ],
        },
      ],
    },
    {
      role: "Software Developer – Associate",
      company: "Cognizant Technology Solutions",
      duration: "Feb 2011 – Jan 2015",
      clientsLine: "Clients: BNYM, JPMC",
      projects: [
        {
          id: "cognizant",
          clientLabel: "BNYM / JPMC",
          duration: "Feb 2011 – Jan 2015",
          bullets: [
            "Migrated legacy modules to AngularJS (1.x) to leverage two-way data binding, dependency injection, and reusable components—improving code structure, maintainability, and developer velocity.",
            "Implemented OAuth 2.0 authentication and centralized token handling; integrated all REST APIs to transmit OAuth bearer tokens (via HTTP interceptors) for secure, seamless calls.",
            "Built interactive UIs using HTML5, CSS3, Bootstrap, jQuery, and JSON for dynamic data exchange.",
            "Developed MVC applications in .NET (ASP.NET MVC) and Spring Framework (Spring MVC), structuring controllers, services, and views for clean separation of concerns.",
            "Designed and maintained SQL Server databases (tables, stored procedures, triggers); automated weekly reporting through scheduled email jobs.",
          ],
        },
      ],
    },
  ],

  education: "Bachelor of Technology in Information Technology.",
};
