"use client";

import { useState, useEffect } from "react";
import emailjs from "emailjs-com";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"success" | "error">("success");
  const [dialogMessage, setDialogMessage] = useState("");

  const showDialog = (type: "success" | "error", message: string) => {
    setDialogType(type);
    setDialogMessage(message);
    setDialogOpen(true);
  };

  useEffect(() => {
    const form = document.getElementById("contact-form") as HTMLFormElement;
    if (form) {
      const handleSubmit = (e: Event) => {
        e.preventDefault();

        emailjs
          .sendForm(
            "service_epaw1g5",
            "template_xgiobnl",
            form,
            "O7IxMgPavA6zaZ2Mq"
          )
          .then(
            () => {
              showDialog("success", "Message sent successfully!");
              form.reset();
            },
            () => {
              showDialog("error", "Failed to send message. Please try again.");
            }
          );
      };

      form.addEventListener("submit", handleSubmit);

      return () => {
        form.removeEventListener("submit", handleSubmit);
      };
    }
  }, []);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Daniel Avila",
    jobTitle: "Desktop Support Technician",
    description:
      "Experienced Desktop Support Technician specializing in hardware, software installation, and technical support",
    url: "https://www.danielavila.tech",
    image: "https://www.danielavila.tech/AvilaProfileImage.png",
    worksFor: [
      {
        "@type": "Organization",
        name: "STORIS, Inc.",
      },
      {
        "@type": "Organization",
        name: "County College of Morris",
      },
    ],
    alumniOf: {
      "@type": "Organization",
      name: "County College of Morris",
    },
    hasCredential: [
      {
        "@type": "EducationalOccupationalCredential",
        credentialCategory: "certificate",
        name: "Microsoft Office Specialist Certification",
        issuedBy: {
          "@type": "Organization",
          name: "Microsoft",
        },
      },
    ],
    knowsAbout: [
      "Desktop Support",
      "Computer Repair",
      "Software Installation",
      "Inventory Management",
      "IT Help Desk",
      "Technical Support",
      "Hardware Troubleshooting",
    ],
    sameAs: [
      "https://linkedin.com/in/danielavila",
      "https://github.com/danielavila",
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="min-h-screen">
        {/* Navigation Bar */}
        <nav className="sticky top-0 z-50 bg-white shadow-sm py-4 animate-[fadeInDown_0.6s_ease-out]">
          <div className="container mx-auto flex justify-between items-center px-4 md:px-8">
            <div className="animate-[fadeIn_0.8s_ease-out]">
              <img
                src="/blue-whale.png"
                alt="Daniel Avila"
                className="h-8 md:h-10 w-auto"
              />
            </div>

            <button
              className="md:hidden text-[#212020] z-50"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>

            <ul className="hidden md:flex gap-8 text-[#212020]">
              <li className="animate-[fadeInDown_0.8s_ease-out_0.1s_both]">
                <a
                  href="#home"
                  className="hover:text-[#3970EB] font-medium transition-colors duration-300"
                >
                  Home
                </a>
              </li>
              <li className="animate-[fadeInDown_0.8s_ease-out_0.2s_both]">
                <a
                  href="#experience"
                  className="hover:text-[#3970EB] font-medium transition-colors duration-300"
                >
                  Experience
                </a>
              </li>
              <li className="animate-[fadeInDown_0.8s_ease-out_0.3s_both]">
                <a
                  href="#projects"
                  className="hover:text-[#3970EB] font-medium transition-colors duration-300"
                >
                  Projects
                </a>
              </li>
              <li className="animate-[fadeInDown_0.8s_ease-out_0.4s_both]">
                <a
                  href="#contact"
                  className="hover:text-[#3970EB] font-medium transition-colors duration-300"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden fixed inset-0 bg-white z-40 pt-20 px-8 animate-[fadeIn_0.3s_ease-out]">
              <ul className="flex flex-col gap-6 text-[#212020] text-lg">
                <li>
                  <a
                    href="#home"
                    className="hover:text-[#3970EB] font-medium transition-colors duration-300 block"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Home
                  </a>
                </li>
                <li>
                  <a
                    href="#experience"
                    className="hover:text-[#3970EB] font-medium transition-colors duration-300 block"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Experience
                  </a>
                </li>
                <li>
                  <a
                    href="#projects"
                    className="hover:text-[#3970EB] font-medium transition-colors duration-300 block"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Projects
                  </a>
                </li>
                <li>
                  <a
                    href="#contact"
                    className="hover:text-[#3970EB] font-medium transition-colors duration-300 block"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          )}
        </nav>

        <section
          className="bg-cover bg-center"
          style={{ backgroundImage: "url('/solid-blue-to-white.png')" }}
        >
          {/* Header Section */}
          <header
            id="home"
            className="relative py-12 md:py-20 overflow-hidden min-h-[600px] md:min-h-[700px] flex items-center"
          >
            <div className="container mx-auto px-4 md:px-8 relative max-w-7xl">
              <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                <div className="order-2 md:order-1 text-center md:text-left space-y-6 animate-[fadeInLeft_1s_ease-out_0.3s_both]">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-md border border-gray-100">
                    <div className="w-2 h-2 bg-[#3970EB] rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold text-[#212020]">
                      Available for opportunities
                    </span>
                  </div>

                  <div className="space-y-3">
                    <h1 className="text-5xl md:text-7xl font-bold text-[#212020] leading-tight">
                      Daniel
                      <span className="block text-[#3970EB]">Avila</span>
                    </h1>
                    <div className="w-24 h-1.5 bg-gradient-to-r from-[#3970EB] to-transparent mx-auto md:mx-0"></div>
                  </div>

                  <h2 className="text-2xl md:text-3xl font-semibold text-gray-700">
                    Desktop Support Technician
                  </h2>

                  <p className="text-base md:text-lg text-gray-600 leading-relaxed max-w-xl mx-auto md:mx-0">
                    Passionate IT professional specializing in technical
                    support, hardware troubleshooting, and streamlined system
                    deployment solutions.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start pt-4">
                    <a
                      href="#contact"
                      className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#3970EB] to-[#2958d4] text-white px-8 py-4 rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                    >
                      <span>Get In Touch</span>
                      <svg
                        className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 8l4 4m0 0l-4 4m4-4H3"
                        />
                      </svg>
                    </a>
                    <a
                      href="#projects"
                      className="inline-flex items-center justify-center gap-2 bg-white text-[#3970EB] px-8 py-4 rounded-full font-bold shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300 border-2 border-[#3970EB]"
                    >
                      <span>View Projects</span>
                    </a>
                  </div>
                </div>

                <div className="order-1 md:order-2 relative animate-[fadeInRight_1s_ease-out_0.3s_both]">
                  <div className="absolute -top-4 -right-4 w-72 h-72 bg-[#3970EB]/10 rounded-full blur-3xl -z-10"></div>
                  <div className="absolute -bottom-4 -left-4 w-64 h-64 bg-[#3970EB]/10 rounded-full blur-3xl -z-10"></div>

                  <div className="relative group">
                    <div className="relative w-full max-w-md mx-auto aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-white group-hover:scale-105 transition-transform duration-500">
                      <img
                        src="/AvilaProfileImage.png"
                        alt="Daniel Avila"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#3970EB]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    </div>

                    <div className="absolute top-4 right-4 w-16 h-16 border-4 border-[#3970EB] rounded-full opacity-50 animate-pulse"></div>
                    <div className="absolute bottom-8 left-4 w-12 h-12 border-4 border-[#3970EB] rounded-full opacity-30"></div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* About Me Section */}
          <section
            id="about"
            className="py-16 md:py-24 px-4 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-96 h-96 bg-[#3970EB]/5 rounded-full blur-3xl -z-10"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#3970EB]/5 rounded-full blur-3xl -z-10"></div>

            <div className="container mx-auto px-4 md:px-8 relative max-w-6xl">
              <div className="flex items-center mb-12 md:mb-16 animate-[slideInLeft_0.8s_ease-out]">
                <div className="w-16 md:w-24 h-1 bg-gradient-to-r from-[#3970EB] to-transparent mr-4"></div>
                <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-[#212020]">
                  ABOUT ME
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                <div className="space-y-6 animate-[fadeInUp_1s_ease-out_0.2s_both]">
                  <div className="space-y-4">
                    <p className="text-lg md:text-xl text-gray-700 leading-relaxed">
                      I am{" "}
                      <span className="font-bold text-[#3970EB]">
                        Daniel Avila
                      </span>
                      , a dedicated Desktop Support Technician with a passion
                      for solving complex technical challenges and delivering
                      exceptional IT support.
                    </p>
                    <p className="text-base md:text-lg text-gray-600 leading-relaxed">
                      Currently working at{" "}
                      <span className="font-semibold text-[#212020]">
                        STORIS, Inc.
                      </span>{" "}
                      and the{" "}
                      <span className="font-semibold text-[#212020]">
                        County College of Morris IT Help Desk
                      </span>
                      , I specialize in hardware troubleshooting, software
                      installation, and providing reliable technical support to
                      end-users.
                    </p>
                    <p className="text-base md:text-lg text-gray-600 leading-relaxed">
                      With hands-on experience in managing IT assets, resolving
                      support tickets, and deploying systems, I strive to create
                      efficient solutions that enhance productivity and user
                      satisfaction.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 animate-[fadeInUp_1s_ease-out_0.4s_both]">
                  <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3970EB] to-[#2958d4] flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-[#212020] mb-2">
                          Technical Expertise
                        </h3>
                        <p className="text-sm text-gray-600">
                          Proficient in hardware repair, software installation,
                          and multi-platform troubleshooting
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3970EB] to-[#2958d4] flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-[#212020] mb-2">
                          User-Focused Support
                        </h3>
                        <p className="text-sm text-gray-600">
                          Committed to delivering efficient solutions and
                          exceptional service to diverse user groups
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3970EB] to-[#2958d4] flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-[#212020] mb-2">
                          Continuous Growth
                        </h3>
                        <p className="text-sm text-gray-600">
                          Always learning and adapting to new technologies and
                          industry best practices
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>

        <section
          className="bg-cover bg-center"
          style={{ backgroundImage: "url('/solid-blue-to-white.png')" }}
        >
          {/* Experience Section */}
          <section
            id="experience"
            className="py-16 md:py-24 px-4 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#3970EB]/5 rounded-full blur-3xl -z-10"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#3970EB]/5 rounded-full blur-3xl -z-10"></div>

            <div className="container mx-auto px-4 md:px-8 relative max-w-6xl">
              <div className="flex items-center mb-12 md:mb-16 animate-[slideInLeft_0.8s_ease-out]">
                <div className="w-16 md:w-24 h-1 bg-gradient-to-r from-[#3970EB] to-transparent mr-4"></div>
                <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-[#212020]">
                  EXPERIENCE
                </h2>
              </div>

              <div className="space-y-8 md:space-y-12">
                <div className="relative animate-[slideInLeft_1s_ease-out_0.2s_both] group">
                  <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-1">
                    <div className="flex flex-col md:flex-row">
                      <div className="md:w-48 bg-gradient-to-br from-gray-50 to-white p-6 md:p-8 flex items-center justify-center border-b md:border-b-0 md:border-r border-gray-100">
                        <img
                          src="/storis-logo.png"
                          alt="STORIS Logo"
                          className="w-24 h-24 md:w-32 md:h-32 object-contain transition-transform duration-500 group-hover:scale-110"
                        />
                      </div>

                      <div className="flex-1 p-6 md:p-8">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                          <div>
                            <h3 className="text-xl md:text-2xl font-bold text-[#212020] mb-2">
                              Desktop Support Technician
                            </h3>
                            <p className="text-base md:text-lg text-[#3970EB] font-semibold mb-2">
                              STORIS, Inc.
                            </p>
                          </div>
                          <span className="inline-block px-4 py-1.5 bg-[#3970EB]/10 text-[#3970EB] text-sm font-semibold rounded-full mt-2 md:mt-0">
                            Part time
                          </span>
                        </div>
                        <p className="text-gray-700 leading-relaxed text-sm md:text-base">
                          Install software and hardware on new laptops, manage
                          IT inventory, resolve employee support tickets, and
                          deploy laptops to remote staff
                        </p>
                        <div className="mt-6 w-16 h-1 bg-gradient-to-r from-[#3970EB] to-transparent"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative animate-[slideInRight_1s_ease-out_0.4s_both] group">
                  <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-1">
                    <div className="flex flex-col md:flex-row">
                      <div className="md:w-48 bg-gradient-to-br from-gray-50 to-white p-6 md:p-8 flex items-center justify-center border-b md:border-b-0 md:border-r border-gray-100">
                        <img
                          src="/ccm-logo.png"
                          alt="County College of Morris Logo"
                          className="w-24 h-24 md:w-32 md:h-32 object-contain transition-transform duration-500 group-hover:scale-110"
                        />
                      </div>

                      <div className="flex-1 p-6 md:p-8">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                          <div>
                            <h3 className="text-xl md:text-2xl font-bold text-[#212020] mb-2">
                              Information Technology Help Desk
                            </h3>
                            <p className="text-base md:text-lg text-[#3970EB] font-semibold mb-2">
                              County College of Morris
                            </p>
                          </div>
                          <span className="inline-block px-4 py-1.5 bg-[#3970EB]/10 text-[#3970EB] text-sm font-semibold rounded-full mt-2 md:mt-0">
                            Part time
                          </span>
                        </div>
                        <p className="text-gray-700 leading-relaxed text-sm md:text-base">
                          Troubleshoot devices (Windows, Mac, Linux, iOS,
                          Android), support campus software, and assist with
                          Wi-Fi/VPN connectivity
                        </p>
                        <div className="mt-6 w-16 h-1 bg-gradient-to-r from-[#3970EB] to-transparent"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Certification Section */}
          <section
            id="certification"
            className="py-16 md:py-24 px-4 relative overflow-hidden"
          >
            <div className="absolute top-20 left-0 w-72 h-72 bg-[#3970EB]/5 rounded-full blur-3xl -z-10"></div>
            <div className="absolute bottom-20 right-0 w-72 h-72 bg-[#3970EB]/5 rounded-full blur-3xl -z-10"></div>

            <div className="container mx-auto px-4 md:px-8 relative max-w-6xl">
              <div className="flex justify-end items-center mb-12 md:mb-16 animate-[slideInRight_0.8s_ease-out]">
                <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-[#212020]">
                  CERTIFICATIONS
                </h2>
                <div className="w-16 md:w-24 h-1 bg-gradient-to-l from-[#3970EB] to-transparent ml-4"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="relative animate-[slideInUp_1s_ease-out_0.2s_both] group">
                  <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-2">
                    <div className="absolute top-4 right-4 z-10">
                      <div className="bg-gradient-to-br from-[#3970EB] to-[#2958d4] text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                        VERIFIED
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-white p-8 md:p-10 flex items-center justify-center border-b border-gray-100 relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#3970EB]/5 to-transparent"></div>
                      <img
                        src="/microsoft-logo.png"
                        alt="Microsoft"
                        className="w-28 h-28 md:w-36 md:h-36 object-contain transition-transform duration-500 group-hover:scale-110 relative z-10"
                      />
                    </div>

                    <div className="p-6 md:p-8">
                      <h3 className="text-lg md:text-xl font-bold text-[#212020] mb-2 leading-tight">
                        Microsoft Office Specialist Certification
                      </h3>
                      <p className="text-sm md:text-base text-[#3970EB] font-semibold mb-4">
                        Microsoft
                      </p>
                      <p className="text-gray-600 text-sm md:text-base leading-relaxed mb-4">
                        Professional certification demonstrating advanced
                        expertise in Microsoft Office applications, and
                        essential workplace software solutions for modern
                        businesses.
                      </p>
                      <div className="flex items-center gap-2 mt-6">
                        <div className="flex-1 h-1 bg-gradient-to-r from-[#3970EB] to-transparent"></div>
                        <svg
                          className="w-5 h-5 text-[#3970EB]"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative animate-[slideInUp_1s_ease-out_0.4s_both] group">
                  <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-2">
                    <div className="absolute top-4 right-4 z-10">
                      <div className="bg-gradient-to-br from-[#3970EB] to-[#2958d4] text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                        VERIFIED
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-white p-8 md:p-10 flex items-center justify-center border-b border-gray-100 relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#3970EB]/5 to-transparent"></div>
                      <img
                        src="/adda-logo.png"
                        alt="ADDA Logo"
                        className="w-28 h-28 md:w-36 md:h-36 object-contain transition-transform duration-500 group-hover:scale-110 relative z-10"
                      />
                    </div>

                    <div className="p-6 md:p-8">
                      <h3 className="text-lg md:text-xl font-bold text-[#212020] mb-2 leading-tight">
                        Apprentice Drafter
                      </h3>
                      <p className="text-sm md:text-base text-[#3970EB] font-semibold mb-4">
                        American Design Drafting Association
                      </p>
                      <p className="text-gray-600 text-sm md:text-base leading-relaxed mb-4">
                        Professional certification in technical drafting and
                        design, demonstrating proficiency in CAD software and
                        technical drawing standards.
                      </p>
                      <div className="flex items-center gap-2 mt-6">
                        <div className="flex-1 h-1 bg-gradient-to-r from-[#3970EB] to-transparent"></div>
                        <svg
                          className="w-5 h-5 text-[#3970EB]"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>

        {/* Projects Section */}
        <section
          id="projects"
          className="py-16 md:py-24 px-4 bg-cover bg-center relative overflow-hidden"
          style={{ backgroundImage: "url('/white-to-blue.png')" }}
        >
          <div className="absolute top-40 right-20 w-80 h-80 bg-[#3970EB]/5 rounded-full blur-3xl -z-10"></div>
          <div className="absolute bottom-40 left-20 w-80 h-80 bg-[#3970EB]/5 rounded-full blur-3xl -z-10"></div>

          <div className="container mx-auto px-4 md:px-8 relative max-w-6xl">
            <div className="flex items-center mb-12 md:mb-16 animate-[slideInLeft_0.8s_ease-out]">
              <div className="w-16 md:w-24 h-1 bg-gradient-to-r from-[#3970EB] to-transparent mr-4"></div>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-[#212020]">
                PROJECTS
              </h2>
            </div>

            <div className="space-y-6 md:space-y-8">
              <div className="relative animate-[slideInLeft_1s_ease-out_0.2s_both] group">
                <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-1">
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-32 bg-gradient-to-br from-[#3970EB] to-[#2958d4] p-6 md:p-8 flex items-center justify-center">
                      <div className="text-white">
                        <div className="text-4xl md:text-5xl font-bold mb-2">
                          01
                        </div>
                        <div className="w-12 h-1 bg-white/50"></div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 p-6 md:p-8">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl md:text-2xl font-bold text-[#212020] mb-3">
                            June 2025 High-Performance PC Build
                          </h3>
                          <p className="text-gray-700 leading-relaxed text-sm md:text-base mb-4">
                            Custom-built workstation featuring AMD Ryzen 9 9900X
                            and Radeon RX 9070XT, optimized for consulting,
                            testing, OS upgrades, and professional software
                            installation. Includes full specs, build photos, and
                            technician services.
                          </p>

                          {/* Tech Stack/Tags */}
                          <div className="flex flex-wrap gap-2 mb-4">
                            <span className="px-3 py-1 bg-[#3970EB]/10 text-[#3970EB] text-xs font-semibold rounded-full">
                              Consulting & Technical Services
                            </span>
                            <span className="px-3 py-1 bg-[#3970EB]/10 text-[#3970EB] text-xs font-semibold rounded-full">
                              Hardware Selection & Assembly
                            </span>
                            <span className="px-3 py-1 bg-[#3970EB]/10 text-[#3970EB] text-xs font-semibold rounded-full">
                              System Configuration (BIOS, OS, Software)
                            </span>
                          </div>
                        </div>

                        {/* CTA Button */}
                        <button
                          onClick={() =>
                            window.open(
                              "https://github.com/Happie04/June-2025-PC-Build",
                              "_blank"
                            )
                          }
                          className="self-start md:self-center flex items-center gap-2 bg-gradient-to-r from-[#3970EB] to-[#2958d4] text-white px-6 py-3 rounded-full font-bold hover:shadow-lg hover:scale-105 transition-all duration-300 group/btn"
                        >
                          <span>View Details</span>
                          <svg
                            className="w-5 h-5 transition-transform duration-300 group-hover/btn:translate-x-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 8l4 4m0 0l-4 4m4-4H3"
                            />
                          </svg>
                        </button>
                      </div>

                      <div className="w-20 h-1 bg-gradient-to-r from-[#3970EB] to-transparent"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative animate-[slideInRight_1s_ease-out_0.4s_both] group">
                <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-1">
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-32 bg-gradient-to-br from-[#3970EB] to-[#2958d4] p-6 md:p-8 flex items-center justify-center">
                      <div className="text-white">
                        <div className="text-4xl md:text-5xl font-bold mb-2">
                          02
                        </div>
                        <div className="w-12 h-1 bg-white/50"></div>
                      </div>
                    </div>

                    <div className="flex-1 p-6 md:p-8">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl md:text-2xl font-bold text-[#212020] mb-3">
                            3D Printing Projects – Custom CAD Models & Prints
                          </h3>
                          <p className="text-gray-700 leading-relaxed text-sm md:text-base mb-4">
                            Collection of 3D-printed projects including video
                            game characters, coasters, and gadgets. Designed
                            from scratch in OnShape, optimized in Cura, and
                            printed on an Ender 3 V2 Pro with premium filament
                            for durable, high-quality results.
                          </p>

                          <div className="flex flex-wrap gap-2 mb-4">
                            <span className="px-3 py-1 bg-[#3970EB]/10 text-[#3970EB] text-xs font-semibold rounded-full">
                              OnShape (CAD Modeling)
                            </span>
                            <span className="px-3 py-1 bg-[#3970EB]/10 text-[#3970EB] text-xs font-semibold rounded-full">
                              Cura (Slicing & Print Optimization)
                            </span>
                            <span className="px-3 py-1 bg-[#3970EB]/10 text-[#3970EB] text-xs font-semibold rounded-full">
                              Ender 3 V2 Pro (3D Printing Hardware)
                            </span>
                          </div>
                        </div>

                        {/* CTA Button */}
                        <button
                          onClick={() =>
                            window.open(
                              "https://github.com/Happie04/3D-Printing-Projects",
                              "_blank"
                            )
                          }
                          className="self-start md:self-center flex items-center gap-2 bg-gradient-to-r from-[#3970EB] to-[#2958d4] text-white px-6 py-3 rounded-full font-bold hover:shadow-lg hover:scale-105 transition-all duration-300 group/btn"
                        >
                          <span>View Details</span>
                          <svg
                            className="w-5 h-5 transition-transform duration-300 group-hover/btn:translate-x-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 8l4 4m0 0l-4 4m4-4H3"
                            />
                          </svg>
                        </button>
                      </div>

                      <div className="w-20 h-1 bg-gradient-to-r from-[#3970EB] to-transparent"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section
          id="contact"
          className="py-16 md:py-24 px-4 relative overflow-hidden"
          style={{ backgroundColor: "#3970EB" }}
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#3970EB]/10 rounded-full blur-3xl -z-10"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#3970EB]/10 rounded-full blur-3xl -z-10"></div>

          <div className="container mx-auto px-4 md:px-8 relative max-w-6xl">
            <div className="text-center mb-12 md:mb-16 animate-[fadeInUp_0.8s_ease-out]">
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-4">
                LET'S CONNECT
              </h2>
              <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
                Have a project in mind or need IT support? Let's discuss how I
                can help bring your ideas to life.
              </p>
            </div>

            <div className="grid md:grid-cols-5 gap-8 md:gap-12">
              <div className="md:col-span-3 animate-[fadeInLeft_1s_ease-out_0.2s_both]">
                <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-10 shadow-xl border border-gray-100">
                  <form id="contact-form" className="space-y-6">
                    <div>
                      <label className="block text-[#212020] font-bold mb-2 text-sm md:text-base">
                        Your Name
                      </label>
                      <input
                        type="text"
                        placeholder="Your Name"
                        name="from_name"
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 md:px-6 md:py-4 text-sm md:text-base focus:outline-none focus:border-[#3970EB] focus:ring-2 focus:ring-[#3970EB]/20 transition-all duration-300"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[#212020] font-bold mb-2 text-sm md:text-base">
                        Email Address
                      </label>
                      <input
                        type="email"
                        placeholder="Your Email"
                        name="from_email"
                        required
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 md:px-6 md:py-4 text-sm md:text-base focus:outline-none focus:border-[#3970EB] focus:ring-2 focus:ring-[#3970EB]/20 transition-all duration-300"
                      />
                    </div>

                    <div>
                      <label className="block text-[#212020] font-bold mb-2 text-sm md:text-base">
                        Message
                      </label>
                      <textarea
                        placeholder="Tell me about your project or inquiry..."
                        rows={5}
                        name="message"
                        required
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 md:px-6 md:py-4 text-sm md:text-base focus:outline-none focus:border-[#3970EB] focus:ring-2 focus:ring-[#3970EB]/20 transition-all duration-300 resize-none"
                      ></textarea>
                    </div>

                    <button
                      type="submit"
                      className="group w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#3970EB] to-[#2958d4] text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
                    >
                      <span>Send Message</span>
                      <svg
                        className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </button>
                  </form>
                </div>
              </div>

              <div className="md:col-span-2 space-y-6 animate-[fadeInRight_1s_ease-out_0.4s_both]">
                <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl border border-gray-100">
                  <h3 className="text-xl md:text-2xl font-bold text-[#212020] mb-6">
                    Get in Touch
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3970EB] to-[#2958d4] flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Phone</p>
                        <p className="text-sm md:text-base font-semibold text-[#212020]">
                          (973) 975-8687
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3970EB] to-[#2958d4] flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Email</p>
                        <p className="text-sm md:text-base font-semibold text-[#212020] break-all">
                          danielavila.office@gmail.com
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3970EB] to-[#2958d4] flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Location</p>
                        <p className="text-sm md:text-base font-semibold text-[#212020]">
                          New Jersey, USA
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl border border-gray-100">
                  <h3 className="text-xl md:text-2xl font-bold text-[#212020] mb-6">
                    Follow Me
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    <a
                      href="/Resume - Daniel Avila.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex-1"
                    >
                      <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl border border-gray-200 hover:border-[#3970EB] transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                        <svg
                          className="w-6 h-6 text-[#3970EB] mx-auto mb-2 transition-transform duration-300 group-hover:scale-110"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                          <path d="M14 2v6h6" />
                          <path d="M16 13H8" />
                          <path d="M16 17H8" />
                          <path d="M10 9H8" />
                        </svg>
                        <p className="text-xs font-semibold text-center text-gray-700">
                          Resume
                        </p>
                      </div>
                    </a>

                    <a
                      href="https://www.linkedin.com/in/danielavila2/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex-1"
                    >
                      <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl border border-gray-200 hover:border-[#3970EB] transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                        <svg
                          className="w-6 h-6 text-[#3970EB] mx-auto mb-2 transition-transform duration-300 group-hover:scale-110"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                        </svg>
                        <p className="text-xs font-semibold text-center text-gray-700">
                          LinkedIn
                        </p>
                      </div>
                    </a>

                    <a
                      href="https://github.com/Happie04"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex-1"
                    >
                      <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl border border-gray-200 hover:border-[#3970EB] transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                        <svg
                          className="w-6 h-6 text-[#3970EB] mx-auto mb-2 transition-transform duration-300 group-hover:scale-110"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                        <p className="text-xs font-semibold text-center text-gray-700">
                          GitHub
                        </p>
                      </div>
                    </a>
                  </div>

                  <p className="text-sm text-gray-600 text-center mt-6 italic">
                    "Simplifying Technology for People and Businesses"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gradient-to-b from-[#2958d4] to-[#3970EB] text-white py-8 md:py-12 px-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -z-10"></div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -z-10"></div>

          <div className="container mx-auto px-4 md:px-8 relative max-w-6xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <p className="text-sm md:text-base text-white/90 mb-2">
                  © 2025 Daniel Avila. All rights reserved.
                </p>
                <p className="text-xs text-white/70">
                  Desktop Support Technician | IT Professional
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                  <span className="text-[#3970EB] font-bold text-lg">DA</span>
                </div>
                <div>
                  <p className="text-white font-bold text-lg leading-tight">
                    Daniel Avila
                  </p>
                  <p className="text-white/70 text-xs">IT Solutions</p>
                </div>
              </div>

              <div className="text-center md:text-right">
                <p className="text-xs text-white/70 mb-2">
                  Crafted with excellence by:
                </p>
                <a
                  href="https://www.caminocode.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:scale-105 transition-transform duration-300"
                  title="Visit Camino Code"
                >
                  <img
                    src="/footer-logo.png"
                    alt="Camino Code Logo"
                    className="h-12 md:h-16 w-auto bg-white rounded-2xl"
                  />
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Custom Dialog */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]"
          onClick={() => setDialogOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-[slideInUp_0.4s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`p-8 ${
                dialogType === "success"
                  ? "bg-gradient-to-br from-blue-50 to-white"
                  : "bg-gradient-to-br from-red-50 to-white"
              }`}
            >
              <div className="flex flex-col items-center text-center">
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
                    dialogType === "success"
                      ? "bg-gradient-to-br from-blue-500 to-blue-600"
                      : "bg-gradient-to-br from-red-500 to-red-600"
                  }`}
                >
                  {dialogType === "success" ? (
                    <svg
                      className="w-10 h-10 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-10 h-10 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  )}
                </div>
                <h3 className="text-2xl font-bold text-[#212020] mb-3">
                  {dialogType === "success" ? "Success!" : "Error"}
                </h3>
                <p className="text-gray-600 mb-6">{dialogMessage}</p>
                <button
                  onClick={() => setDialogOpen(false)}
                  className={`px-8 py-3 rounded-full font-bold text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 ${
                    dialogType === "success"
                      ? "bg-gradient-to-r from-blue-500 to-blue-600"
                      : "bg-gradient-to-r from-red-500 to-red-600"
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
