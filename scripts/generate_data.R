library(jsonlite, quietly = TRUE)

# get dataset type and output directory from command line arguments
args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  stop("Usage: Rscript generate_data.R <dataset_type> <output_dir>")
}
dataset_type <- args[[1]]
output_dir <- args[[2]]

# Create output directory if it does not exist
if (!dir.exists(output_dir)) {
  dir.create(output_dir, showWarnings = FALSE, recursive = TRUE)
}


# Write data to JSON
write_to_json <- function(data, path) {
  jsonlite::write_json(
    data,
    path,
    pretty = TRUE,
    auto_unbox = TRUE,
    null = "null"
  )
}

# Transform dataframe to the expected JSON structure
transform_df <- function(df) {
  columns <- lapply(names(df), function(name) {
    data <- df[[name]]
    dtype <-
      if (is.integer(data)) {
        "integer"
      } else if (is.numeric(data)) {
        "numeric"
      } else if (is.factor(data)) {
        "categorical"
      } else if (is.logical(data)) {
        "boolean"
      } else {
        stop("Unknown / unsupported data type: ", class(data))
      }

    out <- list(
      name = name,
      dtype = dtype,
      data = if (dtype == "categorical") as.integer(data) - 1L else data
    )

    if (dtype == "categorical") {
      out$data <- as.integer(data) - 1L
      out$categories <- as.list(levels(data))
    }

    out
  })

  list(
    num_rows = nrow(df),
    num_cols = ncol(df),
    min_total_counts = 10,
    min_num_nonzero_vars = 10,
    columns = columns
  )
}

# Generate SC dataset
generate_sc_dataset <- function(
  num_samples = 2,
  cells_per_sample = 10,
  total_counts_range = c(10, 56),
  nonzero_vars_range = c(10, 46),
  cellbender_background_mean = 0.4,
  cellbender_background_sd = 0.2,
  cell_size_base = 15,
  cell_size_sd = 10,
  droplet_efficiency_base = 0.93,
  droplet_efficiency_range = 0.05,
  mito_fraction_mean = 0.08,
  mito_fraction_sd = 0.05,
  ribo_fraction_mean = 0.12,
  ribo_fraction_sd = 0.06
) {
  # Sample generation parameters
  total_cells <- num_samples * cells_per_sample

  # Generate sample IDs
  sample_ids <- paste0("sample_", seq_len(num_samples))

  # Generate cell metrics
  set.seed(42)

  # Generate mitochondrial and ribosomal fractions with truncated normal distribution
  mito_fractions <- pmax(
    0,
    pmin(
      1,
      rnorm(total_cells, mito_fraction_mean, mito_fraction_sd)
    )
  )
  ribo_fractions <- pmax(
    0,
    pmin(
      1,
      rnorm(total_cells, ribo_fraction_mean, ribo_fraction_sd)
    )
  )

  # Add some outliers for realism (e.g., stressed or dying cells with high mito content)
  outlier_indices <- sample(1:total_cells, round(total_cells * 0.03))
  mito_fractions[outlier_indices] <- mito_fractions[outlier_indices] * 2.5
  mito_fractions <- pmin(mito_fractions, 0.8) # Cap at 80%

  cell_rna_stats <- data.frame(
    sample_id = factor(rep(
      sample_ids,
      each = cells_per_sample
    )),
    total_counts = rep(
      sample(
        total_counts_range[1]:total_counts_range[2],
        cells_per_sample,
        replace = TRUE
      ),
      num_samples
    ),
    num_nonzero_vars = rep(
      sample(
        nonzero_vars_range[1]:nonzero_vars_range[2],
        cells_per_sample,
        replace = TRUE
      ),
      num_samples
    ),
    fraction_mitochondrial = mito_fractions,
    fraction_ribosomal = ribo_fractions,
    cellbender_background_fraction = pmax(
      0,
      rnorm(
        total_cells,
        cellbender_background_mean,
        cellbender_background_sd
      )
    ) *
      (runif(total_cells) > 0.3),
    cellbender_cell_probability = pmax(runif(total_cells), 0.0002),
    cellbender_cell_size = pmax(
      cell_size_base +
        rnorm(total_cells, 0, cell_size_sd),
      cell_size_base
    ),
    cellbender_droplet_efficiency = droplet_efficiency_base +
      runif(total_cells) * droplet_efficiency_range
  )

  # Generate sample summary stats
  sample_summary_stats <- data.frame(
    sample_id = factor(sample_ids),
    rna_num_barcodes = rep(round(cells_per_sample * 1.5), num_samples),
    rna_num_barcodes_filtered = rep(cells_per_sample, num_samples),
    rna_sum_total_counts = tapply(
      cell_rna_stats$total_counts,
      cell_rna_stats$sample_id,
      sum
    ),
    rna_median_total_counts = tapply(
      cell_rna_stats$total_counts,
      cell_rna_stats$sample_id,
      median
    ),
    rna_overall_num_nonzero_vars = tapply(
      cell_rna_stats$num_nonzero_vars,
      cell_rna_stats$sample_id,
      function(x) max(x) * 1.2  # More realistic gene count multiplier
    ),
    rna_median_num_nonzero_vars = tapply(
      cell_rna_stats$num_nonzero_vars,
      cell_rna_stats$sample_id,
      median
    )
  )

  # Generate cellranger metrics - only include the major ones
  metrics <- c(
    "Cells",
    "Mean_reads_per_cell",
    "Median_UMI_counts_per_cell",
    "Median_genes_per_cell",
    "Sequencing_saturation",
    "Fraction_reads_in_cells",
    "Total_genes_detected",
    "Valid_barcodes"
  )

  set.seed(43)
  metrics_values <- lapply(metrics, function(m) {
    if (grepl("Fraction|Sequencing_saturation|Valid", m)) {
      # Values between 0 and 1
      rep(round(runif(1, 0.01, 0.99), 4), num_samples)
    } else {
      # Integer values
      rep(round(runif(1, 1, 10000)), num_samples)
    }
  })

  names(metrics_values) <- metrics
  metrics_df <- as.data.frame(metrics_values)
  metrics_df$sample_id <- factor(paste0("sample_", seq_len(num_samples)))

  # Return output
  list(
    cell_rna_stats = transform_df(cell_rna_stats),
    sample_summary_stats = transform_df(sample_summary_stats),
    metrics_cellranger_stats = transform_df(metrics_df)
  )
}

generate_sc_structure <- function() {
  cellranger_names <- c(
    "Cells",
    "Mean_reads_per_cell",
    "Median_UMI_counts_per_cell",
    "Median_genes_per_cell",
    "Sequencing_saturation",
    "Fraction_reads_in_cells",
    "Total_genes_detected",
    "Valid_barcodes"
  )
  cell_rna_names <- c(
    "total_counts",
    "num_nonzero_vars",
    "fraction_mitochondrial",
    "fraction_ribosomal",
    "cellbender_background_fraction",
    "cellbender_cell_probability",
    "cellbender_cell_size",
    "cellbender_droplet_efficiency"
  )
  list(
    categories = list(
      list(
        name = "Sample QC",
        key = "sample_summary_stats",
        additionalAxes = FALSE,
        defaultFilters = list()
      ),
      list(
        name = "SampleQC",
        key = "metrics_cellranger_stats",
        additionalAxes = FALSE,
        defaultFilters = lapply(cellranger_names, function(name) {
          list(
            type = "bar",
            field = name,
            label = gsub("_", " ", name),
            description = paste("Description for", name),
            nBins = 10,
            groupBy = "sample_id",
            xAxisType = "linear",
            yAxisType = "linear"
          )
        })
      ),
      list(
        name = "Cell RNA QC",
        key = "cell_rna_stats",
        additionalAxes = TRUE,
        defaultFilters = lapply(cell_rna_names, function(name) {
          list(
            type = "histogram",
            field = name,
            label = gsub("_", " ", name),
            description = paste("Description for", name),
            cutoffMin = NULL,
            cutoffMax = NULL,
            zoomMax = NULL,
            nBins = 50,
            groupBy = "sample_id",
            yAxisType = "linear"
          )
        })
      )
    )
  )
}

# Generate Xenium dataset
generate_xenium_dataset <- function(
  num_samples = 2,
  cells_per_sample = 10,
  total_counts_range = c(16, 78),
  nonzero_vars_range = c(1, 2),
  cell_area_range = c(30, 150),
  nucleus_ratio_range = c(0.1, 0.35),
  spatial_noise = 5,
  mito_fraction_mean = 0.07,
  mito_fraction_sd = 0.04,
  ribo_fraction_mean = 0.10,
  ribo_fraction_sd = 0.05
) {
  # Sample generation parameters
  total_cells <- num_samples * cells_per_sample

  # Generate cell IDs
  set.seed(121)
  random_letters <- replicate(
    cells_per_sample,
    paste0(sample(letters, 8, replace = TRUE), collapse = "")
  )
  cell_ids <- paste0(random_letters, "-1")

  # Generate sample IDs and cell data
  set.seed(123)

  # Create coordinate values that match exactly cells_per_sample length
  # Create a grid pattern for the coordinates
  grid_size <- ceiling(sqrt(cells_per_sample))
  x_base <- rep(seq(400, 400 + grid_size * 10, by = 10), grid_size)[
    1:cells_per_sample
  ]
  y_base <- rep(seq(300, 300 + grid_size * 10, by = 10), each = grid_size)[
    1:cells_per_sample
  ]

  # Generate mitochondrial and ribosomal fractions with truncated normal distribution
  mito_fractions <- pmax(
    0,
    pmin(
      1,
      rnorm(total_cells, mito_fraction_mean, mito_fraction_sd)
    )
  )
  ribo_fractions <- pmax(
    0,
    pmin(
      1,
      rnorm(total_cells, ribo_fraction_mean, ribo_fraction_sd)
    )
  )

  # Add spatial patterns to mito/ribo fractions based on position
  # Cells close to each other might have similar properties
  for (i in seq_len(num_samples)) {
    sample_indices <- ((i - 1) * cells_per_sample + 1):(i * cells_per_sample)
    # Create gradient effect for mito fractions
    mito_fractions[sample_indices] <- mito_fractions[sample_indices] *
      (1 + 0.5 * (x_base - min(x_base)) / (max(x_base) - min(x_base)))

    # Create pattern effect for ribo fractions
    ribo_fractions[sample_indices] <- ribo_fractions[sample_indices] *
      (1 + 0.3 * sin((y_base - min(y_base)) / (max(y_base) - min(y_base)) * pi))
  }

  # Ensure values stay within valid range
  mito_fractions <- pmax(0.01, pmin(0.7, mito_fractions))
  ribo_fractions <- pmax(0.01, pmin(0.6, ribo_fractions))

  cell_rna_stats <- data.frame(
    sample_id = factor(rep(
      paste0("sample_", seq_len(num_samples)),
      each = cells_per_sample
    )),
    total_counts = rep(
      sample(
        total_counts_range[1]:total_counts_range[2],
        cells_per_sample,
        replace = TRUE
      ),
      num_samples
    ),
    num_nonzero_vars = rep(
      sample(
        nonzero_vars_range[1]:nonzero_vars_range[2],
        cells_per_sample,
        replace = TRUE
      ),
      num_samples
    ),
    fraction_mitochondrial = mito_fractions,
    fraction_ribosomal = ribo_fractions,
    cell_area = rep(
      runif(
        cells_per_sample,
        cell_area_range[1],
        cell_area_range[2]
      ),
      num_samples
    ),
    nucleus_ratio = rep(
      runif(
        cells_per_sample,
        nucleus_ratio_range[1],
        nucleus_ratio_range[2]
      ),
      num_samples
    ),
    x_coord = rep(x_base, num_samples) +
      rnorm(total_cells, 0, spatial_noise),
    y_coord = rep(y_base, num_samples) +
      rnorm(total_cells, 0, spatial_noise),
    cell_id = factor(rep(cell_ids, num_samples)),
    segmentation_method = factor(rep(
      "Segmented by nucleus expansion of 5.0µm",
      total_cells
    )),
    region = factor(rep("cell_labels", total_cells))
  )

  # Generate sample summary stats
  sample_summary_stats <- data.frame(
    sample_id = factor(paste0("sample_", seq_len(num_samples))),
    rna_num_barcodes = rep(cells_per_sample * 2, num_samples),
    rna_num_barcodes_filtered = rep(cells_per_sample, num_samples),
    rna_sum_total_counts = tapply(
      cell_rna_stats$total_counts,
      cell_rna_stats$sample_id,
      sum
    ),
    rna_median_total_counts = tapply(
      cell_rna_stats$total_counts,
      cell_rna_stats$sample_id,
      median
    ),
    rna_overall_num_nonzero_vars = rep(
      max(nonzero_vars_range) * 9,
      num_samples
    ),
    rna_median_num_nonzero_vars = tapply(
      cell_rna_stats$num_nonzero_vars,
      cell_rna_stats$sample_id,
      median
    ),
    control_probe_percentage = rep(0, num_samples),
    negative_decoding_percentage = rep(0, num_samples)
  )

  # Return output
  list(
    cell_rna_stats = transform_df(cell_rna_stats),
    sample_summary_stats = transform_df(sample_summary_stats)
  )
}

generate_xenium_structure <- function() {
  colnames <- c("total_counts", "num_nonzero_vars", "fraction_mitochondrial",
                "fraction_ribosomal", "cell_area", "nucleus_ratio")
  list(
    categories = list(
      list(
        name = "Sample QC",
        key = "sample_summary_stats",
        additionalAxes = FALSE,
        defaultFilters = list()
      ),
      list(
        name = "Cell RNA QC",
        key = "cell_rna_stats",
        additionalAxes = TRUE,
        defaultFilters = lapply(colnames, function(col) {
          list(
            type = "histogram",
            visualizationType = "histogram",
            field = col,
            label = gsub("_", " ", col),
            description = paste("Description for", col),
            cutoffMin = NULL,
            cutoffMax = NULL,
            zoomMax = NULL,
            nBins = 50,
            groupBy = "sample_id",
            yAxisType = "linear"
          )
        })
      )
    )
  )
}

generators <- list(
  sc = list(
    label = "Single-cell dataset",
    data_fun = generate_sc_dataset,
    structure_fun = generate_sc_structure
  ),
  sc_large = list(
    label = "Large-scale single-cell dataset",
    data_fun = function() {
      generate_sc_dataset(
        num_samples = 10,
        cells_per_sample = 120000,
        total_counts_range = c(500, 15000),      # More realistic UMI counts
        nonzero_vars_range = c(1000, 8000),     # More realistic gene counts
        cellbender_background_mean = 0.15,      # Reduced background
        cellbender_background_sd = 0.1,
        cell_size_base = 25,                    # Larger cell size
        cell_size_sd = 15,
        droplet_efficiency_base = 0.95,
        droplet_efficiency_range = 0.03,
        mito_fraction_mean = 0.05,              # Lower mitochondrial fraction
        mito_fraction_sd = 0.03,
        ribo_fraction_mean = 0.15,              # Higher ribosomal fraction
        ribo_fraction_sd = 0.05
      )
    },
    structure_fun = generate_sc_structure
  ),
  xenium = list(
    label = "Xenium dataset",
    data_fun = generate_xenium_dataset,
    structure_fun = generate_xenium_structure
  ),
  xenium_large = list(
    label = "Large-scale Xenium dataset",
    data_fun = function() {
      generate_xenium_dataset(
        num_samples = 8,
        cells_per_sample = 150000,               # 1.2M total cells
        total_counts_range = c(50, 800),         # More realistic spatial counts
        nonzero_vars_range = c(20, 150),         # More genes detected in spatial
        cell_area_range = c(25, 200),            # Wider range of cell areas
        nucleus_ratio_range = c(0.08, 0.45),     # Wider nucleus ratio range
        spatial_noise = 3,                       # Tighter spatial organization
        mito_fraction_mean = 0.06,               # Lower mitochondrial in spatial
        mito_fraction_sd = 0.025,
        ribo_fraction_mean = 0.18,               # Higher ribosomal in spatial
        ribo_fraction_sd = 0.04
      )
    },
    structure_fun = generate_xenium_structure
  )
)

# Generate either sc or xenium dataset
if (!dataset_type %in% names(generators)) {
  stop("Invalid dataset type. Use 'sc', 'sc_large', 'xenium', or 'xenium_large'.")
}

params <- generators[[dataset_type]]

# Generate datasets based on specified type
data_path <- file.path(output_dir, "data.json")
structure_path <- file.path(output_dir, "structure.json")

cat("Generating data for ", params$label, "...\n", sep = "")
data <- params$data_fun()

cat("Generating structure for ", params$label, "...\n", sep = "")
structure <- params$structure_fun()

cat("Writing data and structure to JSON files...\n")
write_to_json(data, data_path)
write_to_json(structure, structure_path)

cat(params$label, " dataset generated successfully.\n", sep = "")
cat("  Data: ", data_path, "\n")
cat("  Structure: ", structure_path, "\n\n")
