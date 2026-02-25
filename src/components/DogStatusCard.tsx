// import React from 'react';
import bernerImage from "../images/berner.jpeg";

export default function DogStatusCard() {
  return (
    <div className="relative bg-neutral-primary-soft max-w-xs w-full p-6 border border-default rounded-base shadow-xs">
      {/* <button
        id="dropdownButton"
        data-dropdown-toggle="dropdown"
        className="absolute top-2 end-2 text-body hover:text-heading bg-neutral-primary-soft box-border border border-transparent hover:bg-neutral-tertiary focus:ring-4 focus:ring-neutral-tertiary rounded-base p-1.5 focus:outline-none"
        type="button"
      >
        <span className="sr-only">Open dropdown</span>
        <svg
          className="w-6 h-6"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="3"
            d="M6 12h.01m6 0h.01m5.99 0h.01"
          />
        </svg>
      </button> */}
      {/* Dropdown menu */}
      {/* <div
        id="dropdown"
        className="z-10 bg-neutral-primary-medium border border-default-medium rounded-base shadow-lg w-36 block hidden"
      >
        <ul
          className="p-2 text-sm text-body font-medium"
          aria-labelledby="dropdownButton"
        >
          <li>
            <a
              href="#"
              className="inline-flex items-center w-full p-2 hover:bg-neutral-tertiary-medium hover:text-heading rounded-md"
            >
              Edit
            </a>
          </li>
          <li>
            <a
              href="#"
              className="inline-flex items-center w-full p-2 hover:bg-neutral-tertiary-medium hover:text-heading rounded-md"
            >
              Export Data
            </a>
          </li>
          <li>
            <a
              href="#"
              className="inline-flex items-center w-full p-2 text-fg-danger hover:bg-neutral-tertiary-medium rounded-md"
            >
              Delete
            </a>
          </li>
        </ul>
      </div> */}
      <div className="flex flex-col items-center">
        <img
          className="w-24 h-24 mb-6 rounded-full"
          src={bernerImage}
          alt="Bernese Mountain Dog image"
        />
        <h5 className="mb-0.5 text-xl font-semibold tracking-tight text-heading">
          Bear K
        </h5>
        <div className="flex mt-4 md:mt-6 gap-4"></div>
        <div className="max-w-sm rounded overflow-hidden shadow-lg p-4 mx-auto">
          <div className="font-bold text-xl mb-2">Basic Card</div>
          <ul className="text-gray-700 text-base">
            <p className="font-bold ...">Status labels</p>
            Last fed: 2 hours ago
            <li />
            Last walk: 30 minutes ago
            <li />
            Last toilet: 1 hour ago
            <li />
            Last meds: 4 hours ago
          </ul>
        </div>
      </div>
    </div>
  );
}
