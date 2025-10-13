export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm py-4">
        <div className="container mx-auto flex justify-between items-center px-8">
          <div className="font-bold text-2xl text-gray-800">Daniel Avila</div>
          <ul className="flex gap-8 text-gray-800">
            <li>
              <a href="#home" className="hover:text-gray-600 font-medium">
                Home
              </a>
            </li>
            <li>
              <a href="#skills" className="hover:text-gray-600 font-medium">
                Skills
              </a>
            </li>
            <li>
              <a href="#experience" className="hover:text-gray-600 font-medium">
                Experience
              </a>
            </li>
            <li>
              <a href="#projects" className="hover:text-gray-600 font-medium">
                Projects
              </a>
            </li>
            <li>
              <a href="#contact" className="hover:text-gray-600 font-medium">
                Contact
              </a>
            </li>
          </ul>
        </div>
      </nav>

      {/* Header Section */}
      <header
        id="home"
        className="relative bg-gradient-to-br from-blue-300 via-blue-200 to-purple-200 py-16 overflow-hidden"
      >
        <div className="container mx-auto px-8 flex items-center justify-between">
          {/* Left side content */}
          <div className="z-10">
            <p className="text-gray-800 font-medium mb-2">Desktop Support</p>
            <p className="text-gray-800 font-medium">Technician</p>
          </div>

          {/* Center - Large text background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <h1 className="text-[20rem] font-black text-blue-100/40 leading-none tracking-tight select-none">
              DANIEL
            </h1>
          </div>

          {/* Profile image */}
          <div className="z-10 relative">
            <div className="w-80 h-80 rounded-full overflow-hidden">
              <img
                src="/profile-image.png"
                alt="Daniel Avila"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </header>

      <section>
        {/* About Me Section */}
        <section id="about" className="bg-gray-100 py-20 px-4">
          <div className="container mx-auto max-w-4xl">
            <div className="flex justify-start items-center mb-12">
              <div className="w-48 h-1 bg-gray-800"></div>
              <h2 className="text-5xl font-black tracking-wide text-gray-800 mr-4">
                ABOUT ME
              </h2>
            </div>
            <p className="text-gray-800 leading-relaxed text-xl mb-8">
              I am Daniel Avila,{" "}
              <span className="text-blue-600 font-semibold">
                a dedicated Desktop Support Technician currently working at
                STORIS, Inc.
              </span>{" "}
              and the County College of Morris IT Help Desk. With hands-on
              experience in hardware, software, and technical support, I strive
              to provide efficient solutions, manage IT assets, and deliver
              reliable support to end-users.
            </p>
            <a
              href="#contact"
              className="inline-block bg-blue-600 text-white px-10 py-4 rounded-full text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Connect
            </a>
          </div>
        </section>

        {/* Skills Section */}
        <section
          id="skills"
          className="bg-gradient-to-br from-blue-100 via-blue-50 to-purple-50 py-20 px-4"
        >
          <div className="container mx-auto max-w-6xl">
            <div className="flex justify-end items-center mb-12">
              <h2 className="text-5xl font-black tracking-wide text-gray-800 mr-4">
                SKILLS
              </h2>
              <div className="w-48 h-1 bg-gray-800"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
              <div className="flex flex-col items-center">
                <div className="bg-blue-400 p-8 rounded-2xl shadow-lg mb-4 w-40 h-40 flex items-center justify-center">
                  <svg
                    className="w-24 h-24 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                    <polyline
                      points="22 12 18 12 15 21 9 3 6 12 2 12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 text-center">
                  Desktop
                </h3>
                <h3 className="text-xl font-semibold text-gray-800 text-center">
                  Support
                </h3>
              </div>

              <div className="flex flex-col items-center">
                <div className="bg-blue-400 p-8 rounded-2xl shadow-lg mb-4 w-40 h-40 flex items-center justify-center">
                  <svg
                    className="w-24 h-24 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                    <line
                      x1="18"
                      y1="6"
                      x2="6"
                      y2="18"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                    <line
                      x1="6"
                      y1="6"
                      x2="18"
                      y2="18"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 text-center">
                  Computer
                </h3>
                <h3 className="text-xl font-semibold text-gray-800 text-center">
                  Repair
                </h3>
              </div>

              <div className="flex flex-col items-center">
                <div className="bg-blue-400 p-8 rounded-2xl shadow-lg mb-4 w-40 h-40 flex items-center justify-center">
                  <svg
                    className="w-24 h-24 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 7v6m0 0l-3-3m3 3l3-3"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 text-center">
                  Software
                </h3>
                <h3 className="text-xl font-semibold text-gray-800 text-center">
                  Installation
                </h3>
              </div>

              <div className="flex flex-col items-center">
                <div className="bg-blue-400 p-8 rounded-2xl shadow-lg mb-4 w-40 h-40 flex items-center justify-center">
                  <svg
                    className="w-24 h-24 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                    <rect
                      x="9"
                      y="13"
                      width="2"
                      height="2"
                      fill="currentColor"
                    />
                    <rect
                      x="13"
                      y="13"
                      width="2"
                      height="2"
                      fill="currentColor"
                    />
                    <rect
                      x="9"
                      y="17"
                      width="2"
                      height="2"
                      fill="currentColor"
                    />
                    <rect
                      x="13"
                      y="17"
                      width="2"
                      height="2"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 text-center">
                  Inventory
                </h3>
                <h3 className="text-xl font-semibold text-gray-800 text-center">
                  Management
                </h3>
              </div>
            </div>
          </div>
        </section>
      </section>

      {/* Experience Section */}
      <section
        id="experience"
        className="bg-gradient-to-br from-blue-100 via-blue-50 to-purple-50 py-20 px-4"
      >
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16">
            <div className="w-48 h-1 bg-gray-800 mb-4"></div>
            <h2 className="text-5xl font-black tracking-wide text-gray-800">
              EXPERIENCE
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* STORIS */}
            <div className="relative flex flex-col items-start">
              <div className="bg-white rounded-3xl p-6 mb-6 shadow-lg flex items-center justify-center">
                <img
                  src="/storis-logo.png"
                  alt="STORIS Logo"
                  className="w-28 h-28 object-contain"
                />
              </div>
              <div className="bg-blue-500 text-white rounded-3xl p-8 shadow-lg">
                <h3 className="text-2xl font-bold mb-3">
                  Desktop Support Technician
                </h3>
                <p className="mb-4 text-blue-100">
                  STORIS, Inc&nbsp;&nbsp;&nbsp;Part time
                </p>
                <p className="leading-relaxed">
                  Install software and hardware on new laptops, manage IT
                  inventory, resolve employee support tickets, and deploy
                  laptops to remote staff
                </p>
              </div>
            </div>

            {/* County College of Morris */}
            <div className="relative flex flex-col items-end">
              <div className="bg-white rounded-3xl p-6 mb-6 shadow-lg  flex items-center justify-center">
                <img
                  src="/ccm-logo.png"
                  alt="County College of Morris Logo"
                  className="w-28 h-28 object-contain"
                />
              </div>
              <div className="bg-blue-500 text-white rounded-3xl p-8 shadow-lg">
                <h3 className="text-2xl font-bold mb-3">
                  Information Technology Help Desk
                </h3>
                <p className="mb-4 text-blue-100">
                  County College of Morris&nbsp;&nbsp;&nbsp;Part time
                </p>
                <p className="leading-relaxed">
                  Troubleshoot devices (Windows, Mac, Linux, iOS, Android),
                  support campus software, and assist with Wi-Fi/VPN
                  connectivity
                </p>
              </div>
            </div>

            {/* Microsoft Certification */}
            <div className="relative flex flex-col items-start">
              <div className="bg-white rounded-3xl p-6 mb-6 shadow-lg flex items-center justify-center">
                <div className="grid grid-cols-2 gap-1 w-20 h-20">
                  <div className="bg-red-500"></div>
                  <div className="bg-green-500"></div>
                  <div className="bg-blue-500"></div>
                  <div className="bg-yellow-400"></div>
                </div>
              </div>
              <div className="bg-blue-500 text-white rounded-3xl p-8 shadow-lg">
                <h3 className="text-2xl font-bold mb-3">
                  Microsoft Office Specialist Certification
                </h3>
                <p className="mb-4 text-blue-100">Microsoft</p>
                <p className="leading-relaxed">Lorem ipsum detail.</p>
              </div>
            </div>

            {/* Apprentice Drafter */}
            <div className="relative flex flex-col items-end">
              <div className="bg-white rounded-3xl p-6 mb-6 shadow-lg flex items-center justify-center">
                <img
                  src="/adda-logo.png"
                  alt="ADDA Logo"
                  className="w-28 h-28 object-contain"
                />
              </div>
              <div className="bg-blue-500 text-white rounded-3xl p-8 shadow-lg">
                <h3 className="text-2xl font-bold mb-3">Apprentice Drafter</h3>
                <p className="mb-4 text-blue-100">
                  American Design Drafting Association
                </p>
                <p className="leading-relaxed">Lorem ipsum detail.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section id="projects" className="bg-gray-200 py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex justify-end items-center mb-16">
            <h2 className="text-5xl font-black tracking-wide text-gray-800 mr-4">
              PROJECTS
            </h2>
            <div className="w-48 h-1 bg-gray-800"></div>
          </div>

          <div className="space-y-8">
            {/* Campus IT Support Cases */}
            <div className="bg-blue-400 rounded-3xl p-8 shadow-lg flex flex-col md:flex-row items-center justify-between">
              <button className="bg-white text-gray-800 px-8 py-3 rounded-full font-semibold hover:bg-gray-50 transition-colors mb-6 md:mb-0">
                View Project →
              </button>
              <div className="flex-1 md:ml-8 text-white">
                <div className="bg-white text-gray-800 px-8 py-4 rounded-full inline-block mb-4 font-semibold">
                  Campus IT Support Cases
                </div>
                <p className="text-lg leading-relaxed">
                  Assisted students and staff with technical troubleshooting
                  across multiple platforms.
                </p>
              </div>
            </div>

            {/* Laptop Deployment System */}
            <div className="bg-blue-400 rounded-3xl p-8 shadow-lg flex flex-col md:flex-row items-center justify-between">
              <div className="flex-1 md:mr-8 text-white order-2 md:order-1">
                <div className="bg-white text-gray-800 px-8 py-4 rounded-full inline-block mb-4 font-semibold">
                  Laptop Deployment System
                </div>
                <p className="text-lg leading-relaxed">
                  Managed configuration and deployment of laptops for remote
                  employees at STORIS.
                </p>
              </div>
              <button className="bg-white text-gray-800 px-8 py-3 rounded-full font-semibold hover:bg-gray-50 transition-colors mb-6 md:mb-0 order-1 md:order-2">
                View Project →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section
        id="contact"
        className="bg-gradient-to-br from-blue-100 via-blue-50 to-purple-50 py-20 px-4"
      >
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16">
            <div className="w-48 h-1 bg-gray-800 mb-4"></div>
            <h2 className="text-5xl font-black tracking-wide text-gray-800">
              CONTACT
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Form */}
            <div className="bg-white rounded-3xl p-10 shadow-lg">
              <h3 className="text-3xl font-bold mb-8 text-gray-800">
                LET&apos;S CONNECT!
              </h3>

              <form className="space-y-6">
                <div>
                  <label className="block text-gray-800 font-semibold mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    className="w-full border-2 border-blue-300 rounded-full px-6 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-gray-800 font-semibold mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="Enter your email address"
                    className="w-full border-2 border-blue-300 rounded-full px-6 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-gray-800 font-semibold mb-2">
                    Message
                  </label>
                  <textarea
                    placeholder="Enter your message"
                    rows={5}
                    className="w-full border-2 border-blue-300 rounded-3xl px-6 py-3 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  ></textarea>
                </div>
              </form>
            </div>

            {/* Right Side - Social Links */}
            <div className="flex flex-col justify-center items-center text-center">
              <div className="flex gap-8 mb-8">
                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-xl shadow-lg mb-2 w-16 h-16 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                      <path d="M14 2v6h6" />
                      <path d="M16 13H8" />
                      <path d="M16 17H8" />
                      <path d="M10 9H8" />
                    </svg>
                  </div>
                  <span className="text-gray-800 font-medium text-sm">
                    Resume
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-xl shadow-lg mb-2 w-16 h-16 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </div>
                  <span className="text-gray-800 font-medium text-sm">
                    LinkedIn
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-xl shadow-lg mb-2 w-16 h-16 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                  </div>
                  <span className="text-gray-800 font-medium text-sm">
                    Github
                  </span>
                </div>
              </div>

              <p className="text-gray-800 text-lg font-medium">
                Simplifying Technology for People and Businesses
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-blue-500 text-white py-6 text-center">
        <p className="text-sm">
          © 2025 Daniel Avila. All rights reserved. Made by Camino Code{" "}
          <span>🌸</span>
        </p>
      </footer>
    </div>
  );
}
