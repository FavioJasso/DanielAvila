export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Navigation Bar */}
      <nav className="bg-gray-800 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="font-bold text-xl">Daniel Avila</div>
          <ul className="flex gap-6">
            <li className="hover:text-gray-300 cursor-pointer">Home</li>
            <li className="hover:text-gray-300 cursor-pointer">Skills</li>
            <li className="hover:text-gray-300 cursor-pointer">Experience</li>
            <li className="hover:text-gray-300 cursor-pointer">Projects</li>
            <li className="hover:text-gray-300 cursor-pointer">Contact</li>
          </ul>
        </div>
      </nav>

      {/* Header Section */}
      <header className="bg-gray-100 py-20 text-center">
        <p className="text-sm text-gray-600">Desktop Support Technician</p>
        <p className="text-gray-500">— Hello</p>
        <p className="text-lg mt-4">I AM</p>
        <h1 className="text-5xl font-bold my-4">DANIEL AVILA</h1>
        <p className="text-xl text-gray-700">DESKTOP SUPPORT TECHNICIAN</p>
      </header>

      {/* About Me Section */}
      <section className="container mx-auto py-16 px-4">
        <h2 className="text-3xl font-bold mb-6">ABOUT ME</h2>
        <p className="text-gray-700 leading-relaxed max-w-3xl">
          I am Daniel Avila, a dedicated Desktop Support Technician currently working at STORIS, Inc. and the County College of Morris IT Help Desk. With hands-on experience in hardware, software, and technical support, I strive to provide efficient solutions, manage IT assets, and deliver reliable support to end-users.
        </p>
      </section>

      {/* Skills Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-6">SKILLS</h2>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <li className="bg-white p-4 rounded shadow">Desktop Support</li>
            <li className="bg-white p-4 rounded shadow">Computer Repair</li>
            <li className="bg-white p-4 rounded shadow">Software Installation</li>
            <li className="bg-white p-4 rounded shadow">Inventory Management</li>
          </ul>
        </div>
      </section>

      {/* Experience Section */}
      <section className="container mx-auto py-16 px-4">
        <h2 className="text-3xl font-bold mb-8">EXPERIENCE</h2>

        <div className="mb-8">
          <h3 className="text-xl font-semibold">Desktop Support Technician</h3>
          <p className="text-gray-600 mb-2">STORIS, Inc. — Part time</p>
          <p className="text-gray-700">Install software and hardware on new laptops, manage IT inventory, install antivirus, support tickets, and deploy laptops to remote staff.</p>
        </div>

        <div className="mb-8">
          <h3 className="text-xl font-semibold">Information Technology Help Desk</h3>
          <p className="text-gray-600 mb-2">County College of Morris</p>
          <p className="text-gray-700">Troubleshoot devices (Windows, Mac, Linux, iOS, Android), support campus software, and assist with Wi-Fi/VPN connectivity.</p>
        </div>

        <div className="mb-8">
          <h3 className="text-xl font-semibold">Microsoft Office Specialist Certification</h3>
          <p className="text-gray-600 mb-2">Microsoft</p>
          <p className="text-gray-700">Lorem ipsum detail.</p>
        </div>

        <div className="mb-8">
          <h3 className="text-xl font-semibold">Apprentice Drafter</h3>
          <p className="text-gray-600 mb-2">American Design Drafting Association</p>
          <p className="text-gray-700">Lorem ipsum detail.</p>
        </div>
      </section>

      {/* Projects Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">PROJECTS</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded shadow">
              <h3 className="text-xl font-semibold mb-2">Campus IT Support Cases</h3>
              <p className="text-gray-700">Assisted students and staff with technical troubleshooting across multiple platforms.</p>
            </div>

            <div className="bg-white p-6 rounded shadow">
              <h3 className="text-xl font-semibold mb-2">Laptop Deployment System</h3>
              <p className="text-gray-700">Managed configuration and deployment of laptops for remote employees at STORIS.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="container mx-auto py-16 px-4">
        <h2 className="text-3xl font-bold mb-4">CONTACT</h2>
        <p className="text-xl mb-8">LET&apos;S CONNECT!</p>

        <form className="max-w-lg space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              placeholder="Enter your name"
              className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              placeholder="Enter your email address"
              className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea
              placeholder="Enter your message"
              rows={5}
              className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>

          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Send
          </button>
        </form>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 text-center">
        <p className="font-semibold">LinkedIn</p>
        <p className="text-gray-400 text-sm mt-2">Simplifying technology for people and businesses</p>
      </footer>
    </div>
  );
}
